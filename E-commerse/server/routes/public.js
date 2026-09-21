const express = require("express");
const store = require("../lib/store");
const shop = require("../lib/shop");
const { ok, fail, line, text, int, rateLimit, requireAuth, EMAIL_RE, PHONE_RE } = require("../lib/util");

const router = express.Router();

/* =========================================================
   SETTINGS
========================================================= */

router.get("/settings", (req, res) => ok(res, { settings: shop.publicSettings() }));

/* =========================================================
   PRODUCTS
========================================================= */

router.get("/products", (req, res) => {
    const ratings = shop.ratingMap();
    const products = store
        .db()
        .products.filter(shop.isVisible)
        .map((p) => shop.shapeProduct(p, ratings))
        .sort((a, b) => a.id - b.id);
    ok(res, { products });
});

router.get("/products/:id", (req, res) => {
    const product = store.db().products.find((p) => p.id === int(req.params.id));
    if (!product || !shop.isVisible(product)) return fail(res, 404, "Product not found.");
    ok(res, { product: shop.shapeProduct(product) });
});

/* =========================================================
   REVIEWS
========================================================= */

router.get("/products/:id/reviews", (req, res) => {
    const id = int(req.params.id);
    const reviews = store
        .db()
        .reviews.filter((r) => r.productId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({
            id: r.id,
            name: r.userName,
            rating: r.rating,
            comment: r.comment,
            verified: r.verified,
            createdAt: r.createdAt
        }));
    ok(res, { reviews });
});

router.post("/products/:id/reviews", requireAuth, rateLimit({ max: 20 }), (req, res) => {
    const db = store.db();
    const product = db.products.find((p) => p.id === int(req.params.id));
    if (!product || !shop.isVisible(product)) return fail(res, 404, "Product not found.");

    const rating = int(req.body.rating, 0);
    if (rating < 1 || rating > 5) return fail(res, 400, "Please choose a rating from 1 to 5 stars.");
    const comment = text(req.body.comment, 1000);

    const verified = db.orders.some(
        (o) =>
            o.userId === req.user.id &&
            o.items.some((i) => i.productId === product.id && i.status === "delivered")
    );

    let review = db.reviews.find((r) => r.productId === product.id && r.userId === req.user.id);
    if (review) {
        review.rating = rating;
        review.comment = comment;
        review.verified = verified;
    } else {
        review = {
            id: store.uid(),
            productId: product.id,
            userId: req.user.id,
            userName: req.user.name.split(" ")[0],
            rating,
            comment,
            verified,
            createdAt: new Date().toISOString()
        };
        db.reviews.push(review);
    }
    store.save();
    ok(res, { message: "Thanks for your review!" });
});

/* =========================================================
   COUPONS
========================================================= */

router.post("/coupons/validate", rateLimit({ max: 30 }), (req, res) => {
    const subtotal = int(req.body.subtotal, 0);
    const result = shop.evaluateCoupon(req.body.code, subtotal);
    if (result.error) return fail(res, 400, result.error);
    ok(res, {
        code: result.coupon.code,
        discount: result.discount,
        description:
            result.coupon.type === "percent"
                ? `${result.coupon.value}% off`
                : `NPR ${result.coupon.value.toLocaleString("en-IN")} off`
    });
});

/* =========================================================
   CREATE ORDER
========================================================= */

router.post("/orders", rateLimit({ max: 12 }), (req, res) => {
    const db = store.db();
    const s = shop.settings();
    const b = req.body || {};

    /* ---------- customer + shipping ---------- */
    const customer = {
        name: line(b.customer && b.customer.name, 80),
        email: line(b.customer && b.customer.email, 120).toLowerCase(),
        phone: line(b.customer && b.customer.phone, 18)
    };
    const shipping = {
        address: line(b.shipping && b.shipping.address, 200),
        city: line(b.shipping && b.shipping.city, 60),
        postalCode: line(b.shipping && b.shipping.postalCode, 12)
    };

    if (customer.name.length < 2) return fail(res, 400, "Please enter your full name.");
    if (!EMAIL_RE.test(customer.email)) return fail(res, 400, "Please enter a valid email address.");
    if (!PHONE_RE.test(customer.phone)) return fail(res, 400, "Please enter a valid phone number.");
    if (shipping.address.length < 4) return fail(res, 400, "Please enter your delivery address.");
    if (shipping.city.length < 2) return fail(res, 400, "Please enter your city.");

    /* ---------- payment ---------- */
    const paymentMethod = b.paymentMethod === "online" ? "online" : "cod";
    if (paymentMethod === "cod" && !s.codEnabled) return fail(res, 400, "Cash on delivery is not available right now.");
    if (paymentMethod === "online" && !s.onlineEnabled) return fail(res, 400, "Online payment is not available right now.");
    const paymentRef = paymentMethod === "online" ? line(b.paymentRef, 60) : "";

    /* ---------- items (prices always come from the database) ---------- */
    const rawItems = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
    if (rawItems.length === 0) return fail(res, 400, "Your cart is empty.");

    const merged = new Map();
    for (const raw of rawItems) {
        const id = int(raw.id, 0);
        const quantity = Math.min(20, Math.max(1, int(raw.quantity, 1)));
        const size = line(raw.size, 12);
        const key = `${id}|${size}`;
        merged.set(key, { id, quantity: (merged.get(key)?.quantity || 0) + quantity, size });
    }

    const demand = new Map(); // productId -> total qty (across sizes)
    const items = [];

    for (const entry of merged.values()) {
        const product = db.products.find((p) => p.id === entry.id);
        if (!product || !shop.isVisible(product)) {
            return fail(res, 400, "One of the products in your cart is no longer available. Please review your cart.");
        }
        if (product.sizes.length && !product.sizes.includes(entry.size)) {
            return fail(res, 400, `Please select a size for ${product.name}.`);
        }
        demand.set(product.id, (demand.get(product.id) || 0) + entry.quantity);
        if (demand.get(product.id) > product.stock) {
            return fail(
                res,
                400,
                product.stock > 0
                    ? `Only ${product.stock} left in stock for ${product.name}.`
                    : `${product.name} is out of stock.`
            );
        }
        items.push({
            productId: product.id,
            name: product.name,
            image: product.images[0] || "",
            price: product.price,
            quantity: entry.quantity,
            size: entry.size,
            sellerId: product.sellerId,
            sellerName: shop.sellerName(product.sellerId),
            status: "pending"
        });
    }

    /* ---------- totals ---------- */
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    let discount = 0;
    let couponCode = "";
    let coupon = null;
    if (b.couponCode) {
        const result = shop.evaluateCoupon(b.couponCode, subtotal);
        if (result.error) return fail(res, 400, result.error);
        coupon = result.coupon;
        discount = result.discount;
        couponCode = coupon.code;
    }

    const afterDiscount = subtotal - discount;
    const shippingFee = s.freeShippingThreshold > 0 && afterDiscount >= s.freeShippingThreshold ? 0 : s.shippingFee;
    const total = afterDiscount + shippingFee;

    // The browser sends the total the customer saw. If prices/stock changed meanwhile, ask them to confirm again.
    if (b.expectedTotal !== undefined && int(b.expectedTotal, -1) !== total) {
        return fail(res, 409, `Prices or delivery charges have changed. Your new total is NPR ${total.toLocaleString("en-IN")}. Please review your order and place it again.`, { total });
    }

    /* ---------- commit ---------- */
    for (const item of items) {
        const product = db.products.find((p) => p.id === item.productId);
        product.stock -= item.quantity;
        product.sold = (product.sold || 0) + item.quantity;
    }
    if (coupon) coupon.used += 1;

    const now = new Date().toISOString();
    const order = {
        id: shop.newOrderId(),
        userId: req.user ? req.user.id : null,
        customer,
        shipping,
        notes: text(b.notes, 300),
        items,
        subtotal,
        discount,
        couponCode,
        shippingFee,
        total,
        paymentMethod,
        paymentStatus: "pending",
        paymentRef,
        status: "pending",
        timeline: [{ status: "pending", at: now, note: "Order placed", by: "customer" }],
        createdAt: now,
        updatedAt: now
    };
    db.orders.push(order);
    store.save();

    ok(res, { order: shop.orderView(order) });
});

/* =========================================================
   TRACK ORDER (guests too)
========================================================= */

router.post("/orders/track", rateLimit({ max: 15 }), (req, res) => {
    const id = line(req.body.orderId, 30).toUpperCase();
    const contact = line(req.body.contact, 120).toLowerCase();
    const digits = contact.replace(/\D/g, "");

    const order = store.db().orders.find((o) => o.id === id);
    const matches =
        order &&
        contact &&
        (order.customer.email === contact ||
            (digits.length >= 7 && order.customer.phone.replace(/\D/g, "").endsWith(digits.slice(-7))));

    if (!matches) return fail(res, 404, "We could not find an order with those details. Check the order ID and your email or phone.");
    ok(res, { order: shop.orderView(order) });
});

/* =========================================================
   CONTACT FORM
========================================================= */

router.post("/contact", rateLimit({ max: 6 }), (req, res) => {
    const name = line(req.body.name, 80);
    const email = line(req.body.email, 120).toLowerCase();
    const subject = line(req.body.subject, 120);
    const message = text(req.body.message, 2000);

    if (name.length < 2) return fail(res, 400, "Please enter your name.");
    if (!EMAIL_RE.test(email)) return fail(res, 400, "Please enter a valid email address.");
    if (message.length < 10) return fail(res, 400, "Please write a message (at least 10 characters).");

    store.db().messages.push({
        id: store.uid(),
        name,
        email,
        subject: subject || "General enquiry",
        message,
        read: false,
        createdAt: new Date().toISOString()
    });
    store.save();
    ok(res, { message: "Thanks! We received your message and will reply soon." });
});

module.exports = router;
