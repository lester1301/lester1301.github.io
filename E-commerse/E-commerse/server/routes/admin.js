const express = require("express");
const crypto = require("crypto");
const store = require("../lib/store");
const shop = require("../lib/shop");
const email = require("../lib/email");
const { toCsv } = require("../lib/csv");
const { dailySeries } = require("../lib/stats");
const { requireRole, hashPassword, ok, fail, line, text, int, EMAIL_RE, PHONE_RE, publicUser } = require("../lib/util");

const router = express.Router();
router.use(requireRole("admin"));

/* =========================================================
   DASHBOARD
========================================================= */

router.get("/stats", (req, res) => {
    const db = store.db();
    const s = shop.settings();

    const live = db.orders.filter((o) => o.status !== "cancelled");
    const sales = live.reduce((sum, o) => sum + o.total, 0);

    const top = new Map();
    for (const o of live) {
        for (const i of o.items) {
            if (i.status === "cancelled") continue;
            const row = top.get(i.productId) || { id: i.productId, name: i.name, image: i.image, units: 0, revenue: 0 };
            row.units += i.quantity;
            row.revenue += i.price * i.quantity;
            top.set(i.productId, row);
        }
    }

    ok(res, {
        stats: {
            sales,
            paid: db.orders.filter((o) => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0),
            orders: db.orders.length,
            newOrders: db.orders.filter((o) => o.status === "pending").length,
            awaitingPayment: db.orders.filter((o) => o.paymentMethod === "online" && o.paymentStatus === "pending" && o.status !== "cancelled").length,
            customers: db.users.filter((u) => u.role === "customer").length,
            sellers: db.users.filter((u) => u.role === "seller" && u.status === "active").length,
            sellersPending: db.users.filter((u) => u.role === "seller" && u.status === "pending").length,
            products: db.products.filter(shop.isVisible).length,
            productsPending: db.products.filter((p) => p.status === "pending").length,
            unreadMessages: db.messages.filter((m) => !m.read).length
        },
        chart: dailySeries(live.map((o) => ({ at: o.createdAt, amount: o.total })), 14),
        topProducts: [...top.values()].sort((a, b) => b.units - a.units).slice(0, 5),
        lowStock: db.products
            .filter((p) => p.stock <= s.lowStockAt && ["active", "draft", "pending"].includes(p.status))
            .slice(0, 8)
            .map((p) => ({ id: p.id, name: p.name, stock: p.stock, seller: shop.sellerName(p.sellerId) })),
        recent: db.orders
            .slice(-7)
            .reverse()
            .map((o) => ({ id: o.id, customer: o.customer.name, total: o.total, status: o.status, paymentStatus: o.paymentStatus, createdAt: o.createdAt }))
    });
});

/* =========================================================
   USERS + SELLERS
========================================================= */

router.get("/users", (req, res) => {
    const db = store.db();
    const users = db.users
        .map((u) => {
            const orders = db.orders.filter((o) => o.userId === u.id && o.status !== "cancelled");
            return {
                ...publicUser(u),
                orders: orders.length,
                spent: orders.reduce((sum, o) => sum + o.total, 0),
                products: u.role === "seller" ? db.products.filter((p) => p.sellerId === u.id).length : 0
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    ok(res, { users });
});

router.put("/users/:id", (req, res) => {
    const user = store.db().users.find((u) => u.id === req.params.id);
    if (!user) return fail(res, 404, "User not found.");
    if (user.id === req.user.id) return fail(res, 400, "You can't change your own account here.");

    if (req.body.status !== undefined) {
        if (!["active", "blocked", "pending"].includes(req.body.status)) return fail(res, 400, "Invalid status.");
        const wasPendingSeller = user.role === "seller" && user.status === "pending";
        user.status = req.body.status;
        if (wasPendingSeller && user.status === "active") {
            email.sellerApproved(user, (process.env.SITE_URL || "") + "/seller/index.html", shop.settings().storeName).catch(() => {});
        }
    }
    if (req.body.role !== undefined) {
        if (!["customer", "seller", "admin"].includes(req.body.role)) return fail(res, 400, "Invalid role.");
        user.role = req.body.role;
        if (user.role === "seller" && !user.shop) user.shop = { name: user.name + "'s Shop", description: "", address: "" };
    }
    store.save();
    ok(res, { user: publicUser(user) });
});

router.post("/users/:id/reset-password", async (req, res) => {
    const user = store.db().users.find((u) => u.id === req.params.id);
    if (!user) return fail(res, 404, "User not found.");
    const temp = crypto.randomBytes(6).toString("base64url");
    user.passwordHash = await hashPassword(temp);
    store.save();
    ok(res, { tempPassword: temp, message: "Password reset. Share this temporary password with the user securely." });
});

router.post("/users", async (req, res) => {
    // create staff / seller accounts directly
    const db = store.db();
    const name = line(req.body.name, 80);
    const email = line(req.body.email, 120).toLowerCase();
    const role = ["customer", "seller", "admin"].includes(req.body.role) ? req.body.role : "customer";
    const password = String(req.body.password || "");
    const phone = line(req.body.phone, 18);

    if (name.length < 2) return fail(res, 400, "Please enter a name.");
    if (!EMAIL_RE.test(email)) return fail(res, 400, "Please enter a valid email.");
    if (phone && !PHONE_RE.test(phone)) return fail(res, 400, "Please enter a valid phone number.");
    if (password.length < 8) return fail(res, 400, "Password must be at least 8 characters.");
    if (db.users.some((u) => u.email === email)) return fail(res, 409, "This email is already registered.");

    const user = {
        id: store.uid(),
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        role,
        status: "active",
        shop: role === "seller" ? { name: line(req.body.shopName, 80) || name + "'s Shop", description: "", address: "" } : null,
        addresses: [],
        wishlist: [],
        createdAt: new Date().toISOString()
    };
    db.users.push(user);
    store.save();
    ok(res, { user: publicUser(user) });
});

/* =========================================================
   PRODUCTS
========================================================= */

router.get("/products", (req, res) => {
    const ratings = shop.ratingMap();
    ok(res, {
        products: store.db().products.map((p) => shop.shapeProduct(p, ratings, true)).sort((a, b) => b.id - a.id)
    });
});

router.post("/products", (req, res) => {
    const result = shop.cleanProductInput(req.body);
    if (result.error) return fail(res, 400, result.error);
    const now = new Date().toISOString();
    const product = {
        id: store.nextProductId(),
        sellerId: req.user.id,
        ...result.value,
        status: req.body.status === "draft" ? "draft" : "active",
        approved: true,
        rejectReason: "",
        sold: 0,
        createdAt: now,
        updatedAt: now
    };
    store.db().products.push(product);
    store.save();
    ok(res, { product: shop.shapeProduct(product, shop.ratingMap(), true), message: "Product created." });
});

router.put("/products/:id", (req, res) => {
    const product = store.db().products.find((p) => p.id === int(req.params.id));
    if (!product) return fail(res, 404, "Product not found.");

    // quick moderation actions: { action: "approve" | "reject" | "archive" | "restore", reason }
    if (req.body.action) {
        switch (req.body.action) {
            case "approve":
                product.approved = true;
                product.status = "active";
                product.rejectReason = "";
                break;
            case "reject":
                product.approved = false;
                product.status = "rejected";
                product.rejectReason = line(req.body.reason, 200) || "Not approved. Please review the product details.";
                break;
            case "archive":
                product.status = "archived";
                break;
            case "restore":
                product.status = product.approved ? "active" : "pending";
                break;
            default:
                return fail(res, 400, "Unknown action.");
        }
        product.updatedAt = new Date().toISOString();
        store.save();
        return ok(res, { product: shop.shapeProduct(product, shop.ratingMap(), true) });
    }

    const result = shop.cleanProductInput(req.body, product);
    if (result.error) return fail(res, 400, result.error);
    Object.assign(product, result.value);
    if (product.approved && ["active", "draft"].includes(req.body.status)) product.status = req.body.status;
    product.updatedAt = new Date().toISOString();
    store.save();
    ok(res, { product: shop.shapeProduct(product, shop.ratingMap(), true), message: "Product saved." });
});

router.delete("/products/:id", (req, res) => {
    const db = store.db();
    const product = db.products.find((p) => p.id === int(req.params.id));
    if (!product) return fail(res, 404, "Product not found.");

    if (db.orders.some((o) => o.items.some((i) => i.productId === product.id))) {
        product.status = "archived";
        store.save();
        return ok(res, { message: "Product archived (it has past orders)." });
    }
    db.products = db.products.filter((p) => p.id !== product.id);
    db.reviews = db.reviews.filter((r) => r.productId !== product.id);
    store.save();
    ok(res, { message: "Product deleted." });
});

/* =========================================================
   ORDERS
========================================================= */

router.get("/orders", (req, res) => {
    ok(res, {
        orders: store.db().orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => shop.orderView(o))
    });
});

router.put("/orders/:id", (req, res) => {
    const order = store.db().orders.find((o) => o.id === req.params.id);
    if (!order) return fail(res, 404, "Order not found.");

    const { status, paymentStatus, note } = req.body || {};

    if (paymentStatus !== undefined) {
        if (!["pending", "paid", "failed", "refunded"].includes(paymentStatus)) return fail(res, 400, "Invalid payment status.");
        if (order.paymentStatus !== paymentStatus) {
            order.paymentStatus = paymentStatus;
            order.timeline.push({ status: order.status, at: new Date().toISOString(), note: `Payment marked ${paymentStatus}`, by: "admin" });
            order.updatedAt = new Date().toISOString();
        }
    }

    if (status !== undefined) {
        if (!shop.ITEM_STATUSES.includes(status)) return fail(res, 400, "Invalid status.");
        const changed = shop.setItemsStatus(order, () => true, status, "admin", line(note, 200));
        if (!changed && status !== order.status) return fail(res, 400, "Delivered or cancelled items can't be changed.");
    }

    store.save();
    ok(res, { order: shop.orderView(order) });
});

/* =========================================================
   COUPONS
========================================================= */

router.get("/coupons", (req, res) => ok(res, { coupons: store.db().coupons }));

router.post("/coupons", (req, res) => {
    const db = store.db();
    const code = line(req.body.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const type = req.body.type === "fixed" ? "fixed" : "percent";
    const value = int(req.body.value, 0);

    if (code.length < 3) return fail(res, 400, "Coupon code must be at least 3 letters or numbers.");
    if (db.coupons.some((c) => c.code === code)) return fail(res, 409, "This coupon code already exists.");
    if (value < 1 || (type === "percent" && value > 90)) return fail(res, 400, type === "percent" ? "Percent discount must be between 1 and 90." : "Enter a valid discount amount.");

    const coupon = {
        code,
        type,
        value,
        minOrder: int(req.body.minOrder, 0),
        maxDiscount: type === "percent" ? int(req.body.maxDiscount, 0) : 0,
        usageLimit: int(req.body.usageLimit, 0),
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt + "T23:59:59").toISOString() : "",
        used: 0,
        active: true,
        createdAt: new Date().toISOString()
    };
    db.coupons.push(coupon);
    store.save();
    ok(res, { coupons: db.coupons });
});

router.put("/coupons/:code", (req, res) => {
    const coupon = store.db().coupons.find((c) => c.code === req.params.code);
    if (!coupon) return fail(res, 404, "Coupon not found.");
    if (req.body.active !== undefined) coupon.active = !!req.body.active;
    store.save();
    ok(res, { coupons: store.db().coupons });
});

router.delete("/coupons/:code", (req, res) => {
    const db = store.db();
    db.coupons = db.coupons.filter((c) => c.code !== req.params.code);
    store.save();
    ok(res, { coupons: db.coupons });
});

/* =========================================================
   REVIEWS
========================================================= */

router.get("/reviews", (req, res) => {
    const db = store.db();
    const reviews = db.reviews
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({ ...r, productName: (db.products.find((p) => p.id === r.productId) || {}).name || "Deleted product" }));
    ok(res, { reviews });
});

router.delete("/reviews/:id", (req, res) => {
    const db = store.db();
    db.reviews = db.reviews.filter((r) => r.id !== req.params.id);
    store.save();
    ok(res, {});
});

/* =========================================================
   MESSAGES
========================================================= */

router.get("/messages", (req, res) => {
    ok(res, { messages: store.db().messages.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

router.put("/messages/:id", (req, res) => {
    const message = store.db().messages.find((m) => m.id === req.params.id);
    if (!message) return fail(res, 404, "Message not found.");
    message.read = req.body.read !== false;
    store.save();
    ok(res, {});
});

router.delete("/messages/:id", (req, res) => {
    const db = store.db();
    db.messages = db.messages.filter((m) => m.id !== req.params.id);
    store.save();
    ok(res, {});
});

/* =========================================================
   SETTINGS
========================================================= */

router.get("/settings", (req, res) => ok(res, { settings: shop.settings() }));

router.put("/settings", (req, res) => {
    const s = shop.settings();
    const b = req.body || {};

    if (b.storeName !== undefined) s.storeName = line(b.storeName, 60) || s.storeName;
    if (b.tagline !== undefined) s.tagline = line(b.tagline, 140);
    if (b.email !== undefined) {
        const email = line(b.email, 120);
        if (email && !EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid support email.");
        s.email = email;
    }
    if (b.phone !== undefined) s.phone = line(b.phone, 30);
    if (b.address !== undefined) s.address = line(b.address, 200);
    if (b.announcement !== undefined) s.announcement = line(b.announcement, 200);
    if (b.shippingFee !== undefined) s.shippingFee = Math.max(0, int(b.shippingFee, s.shippingFee));
    if (b.freeShippingThreshold !== undefined) s.freeShippingThreshold = Math.max(0, int(b.freeShippingThreshold, 0));
    if (Array.isArray(b.shippingRules)) {
        const rules = [];
        const seen = new Set();
        for (const r of b.shippingRules) {
            const city = line(r.city, 60);
            const fee = int(r.fee, NaN);
            if (!city || !Number.isFinite(fee) || fee < 0) continue;
            const key = city.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            rules.push({ city, fee });
        }
        s.shippingRules = rules.slice(0, 100);
    }
    if (b.bankDetails !== undefined) s.bankDetails = text(b.bankDetails, 500);
    if (b.gaId !== undefined) {
        const ga = line(b.gaId, 20);
        if (ga && !/^G-[A-Z0-9]{4,12}$/.test(ga)) return fail(res, 400, "Google Analytics ID should look like G-XXXXXXXXXX, or leave it empty.");
        s.gaId = ga;
    }
    if (b.commissionPercent !== undefined) s.commissionPercent = Math.min(90, Math.max(0, int(b.commissionPercent, 0)));
    if (b.lowStockAt !== undefined) s.lowStockAt = Math.max(0, int(b.lowStockAt, 5));
    if (b.autoApproveProducts !== undefined) s.autoApproveProducts = !!b.autoApproveProducts;
    if (b.codEnabled !== undefined) s.codEnabled = !!b.codEnabled;
    if (b.onlineEnabled !== undefined) s.onlineEnabled = !!b.onlineEnabled;
    if (!s.codEnabled && !s.onlineEnabled) return fail(res, 400, "Keep at least one payment method enabled.");
    if (b.onlineInstructions !== undefined) s.onlineInstructions = text(b.onlineInstructions, 500);

    if (b.socials && typeof b.socials === "object") {
        for (const key of ["instagram", "facebook", "twitter"]) {
            if (b.socials[key] !== undefined) {
                const url = line(b.socials[key], 200);
                if (url && !/^https?:\/\//i.test(url)) return fail(res, 400, `The ${key} link must start with https://`);
                s.socials[key] = url;
            }
        }
    }

    if (Array.isArray(b.categories)) {
        const seen = new Set();
        const categories = [];
        for (const c of b.categories) {
            const name = line(c.name, 40);
            if (!name) continue;
            const slug = line(c.slug || name, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            if (!slug || seen.has(slug)) continue;
            seen.add(slug);
            categories.push({ slug, name });
        }
        if (categories.length === 0) return fail(res, 400, "Keep at least one category.");
        const removed = s.categories.filter((c) => !seen.has(c.slug));
        for (const c of removed) {
            if (store.db().products.some((p) => p.category === c.slug)) {
                return fail(res, 400, `You can't remove "${c.name}" because products still use it. Move those products first.`);
            }
        }
        s.categories = categories;
    }

    if (Array.isArray(b.banners)) {
        const banners = [];
        for (const banner of b.banners) {
            const image = String(banner.image || "").trim();
            if (!image) continue;
            banners.push({
                image,
                title: line(banner.title, 80),
                subtitle: line(banner.subtitle, 160),
                ctaText: line(banner.ctaText, 30) || "Shop now",
                ctaLink: /^(https?:\/\/|[a-zA-Z0-9_-]+\.html)/.test(banner.ctaLink || "") ? banner.ctaLink.trim() : "products.html"
            });
        }
        if (!banners.length) return fail(res, 400, "Add at least one homepage banner.");
        s.banners = banners.slice(0, 6);
    }

    store.save();
    ok(res, { settings: s, message: "Settings saved." });
});

/* =========================================================
   RETURNS
========================================================= */

router.get("/returns", (req, res) => {
    const db = store.db();
    const out = [];
    for (const order of db.orders) {
        for (const item of order.items) {
            if (item.returnStatus) out.push({ orderId: order.id, productId: item.productId, name: item.name, image: item.image, quantity: item.quantity, price: item.price, size: item.size, seller: item.sellerName, customer: order.customer, returnStatus: item.returnStatus, returnReason: item.returnReason, requestedAt: item.returnRequestedAt });
        }
    }
    out.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    ok(res, { returns: out });
});

router.put("/returns/:orderId/:productId", (req, res) => {
    const order = store.db().orders.find((o) => o.id === req.params.orderId);
    if (!order) return fail(res, 404, "Order not found.");
    const item = order.items.find((i) => i.productId === int(req.params.productId, 0));
    if (!item || !item.returnStatus) return fail(res, 404, "Return request not found.");

    const action = req.body.action;
    if (!["approve", "reject", "refunded"].includes(action)) return fail(res, 400, "Choose a valid action.");
    if (action === "approve") item.returnStatus = "approved";
    if (action === "reject") item.returnStatus = "rejected";
    if (action === "refunded") {
        item.returnStatus = "refunded";
        shop.returnStock(store.db().products.find((p) => p.id === item.productId) || {}, item.size, item.quantity);
    }
    order.timeline.push({ status: order.status, at: new Date().toISOString(), note: `Return for "${item.name}" marked ${item.returnStatus}`, by: "admin" });
    order.updatedAt = new Date().toISOString();
    store.save();
    ok(res, { message: "Return updated." });
});

/* =========================================================
   SELLER PAYOUTS
========================================================= */

function pendingForSeller(sellerId) {
    const db = store.db();
    const covered = new Set(db.payouts.filter((p) => p.sellerId === sellerId).flatMap((p) => p.coveredOrderIds));
    let amount = 0;
    const orderIds = [];
    for (const order of db.orders) {
        const items = order.items.filter((i) => i.sellerId === sellerId && i.status === "delivered" && i.returnStatus !== "refunded");
        if (!items.length || covered.has(order.id)) continue;
        amount += items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        orderIds.push(order.id);
    }
    return { amount, orderIds };
}

router.get("/payouts", (req, res) => {
    const db = store.db();
    const commission = shop.settings().commissionPercent || 0;
    const sellers = db.users.filter((u) => u.role === "seller");
    const summary = sellers.map((u) => {
        const pending = pendingForSeller(u.id);
        const paidTotal = db.payouts.filter((p) => p.sellerId === u.id).reduce((s, p) => s + p.amount, 0);
        return {
            sellerId: u.id,
            name: (u.shop && u.shop.name) || u.name,
            pendingGross: pending.amount,
            pendingNet: Math.round(pending.amount * (1 - commission / 100)),
            orderCount: pending.orderIds.length,
            paidTotal
        };
    }).filter((s) => s.pendingGross > 0 || s.paidTotal > 0);
    ok(res, { payouts: db.payouts.slice().sort((a, b) => b.paidAt.localeCompare(a.paidAt)), summary, commissionPercent: commission });
});

router.post("/payouts", (req, res) => {
    const sellerId = req.body.sellerId;
    const user = store.db().users.find((u) => u.id === sellerId && u.role === "seller");
    if (!user) return fail(res, 404, "Seller not found.");
    const pending = pendingForSeller(sellerId);
    if (!pending.amount) return fail(res, 400, "There is nothing pending to pay out for this seller.");
    const commission = shop.settings().commissionPercent || 0;
    const net = Math.round(pending.amount * (1 - commission / 100));
    const payout = { id: store.uid(), sellerId, sellerName: (user.shop && user.shop.name) || user.name, amount: net, grossAmount: pending.amount, coveredOrderIds: pending.orderIds, note: line(req.body.note, 200), paidAt: new Date().toISOString() };
    store.db().payouts.push(payout);
    store.save();
    ok(res, { payout, message: `Marked NPR ${net.toLocaleString("en-IN")} as paid to ${payout.sellerName}.` });
});

/* =========================================================
   CSV EXPORTS
========================================================= */

router.get("/export/orders.csv", (req, res) => {
    const rows = store.db().orders.map((o) => [o.id, o.createdAt, o.customer.name, o.customer.email, o.customer.phone, o.status, o.paymentMethod, o.paymentStatus, o.subtotal, o.discount, o.shippingFee, o.total, `${o.shipping.address}, ${o.shipping.city}`]);
    const csv = toCsv(["Order ID", "Date", "Customer", "Email", "Phone", "Status", "Payment method", "Payment status", "Subtotal", "Discount", "Delivery", "Total", "Address"], rows);
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="orders-${Date.now()}.csv"`);
    res.send(csv);
});

router.get("/export/users.csv", (req, res) => {
    const rows = store.db().users.map((u) => [u.id, u.name, u.email, u.phone, u.role, u.status, u.createdAt]);
    const csv = toCsv(["ID", "Name", "Email", "Phone", "Role", "Status", "Joined"], rows);
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="users-${Date.now()}.csv"`);
    res.send(csv);
});

/* =========================================================
   BACKUP + RESTORE
   The whole database as one JSON file — a manual safety net on top of
   whatever hosting-level backups you may have.
========================================================= */

router.get("/backup", (req, res) => {
    res.set("Content-Type", "application/json");
    res.set("Content-Disposition", `attachment; filename="shopease-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(store.db(), null, 2));
});

router.post("/restore", express.json({ limit: "20mb" }), (req, res) => {
    const data = req.body;
    const required = ["users", "products", "orders", "settings"];
    if (!data || typeof data !== "object" || !required.every((k) => k in data)) {
        return fail(res, 400, "This doesn't look like a ShopEase backup file.");
    }
    if (req.body.confirm !== "REPLACE") {
        return fail(res, 400, 'To confirm this replaces ALL current data, resend with "confirm": "REPLACE".');
    }
    store.replace(data);
    ok(res, { message: "Backup restored. Refresh the page." });
});

module.exports = router;
