const store = require("./store");
const { line, text, int } = require("./util");

const ITEM_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const FINAL_STATUSES = ["delivered", "cancelled"];

/* =========================================================
   SETTINGS / CATEGORIES
========================================================= */

function settings() {
    return store.db().settings;
}

function publicSettings() {
    const s = settings();
    return {
        storeName: s.storeName,
        tagline: s.tagline,
        email: s.email,
        phone: s.phone,
        address: s.address,
        shippingFee: s.shippingFee,
        freeShippingThreshold: s.freeShippingThreshold,
        announcement: s.announcement,
        codEnabled: s.codEnabled,
        onlineEnabled: s.onlineEnabled,
        onlineInstructions: s.onlineInstructions,
        socials: s.socials,
        categories: s.categories
    };
}

function categoryName(slug) {
    const found = settings().categories.find((c) => c.slug === slug);
    return found ? found.name : slug;
}

/* =========================================================
   PRODUCTS
========================================================= */

function ratingMap() {
    const map = new Map();
    for (const r of store.db().reviews) {
        const entry = map.get(r.productId) || { sum: 0, count: 0 };
        entry.sum += r.rating;
        entry.count += 1;
        map.set(r.productId, entry);
    }
    return map;
}

function sellerName(sellerId) {
    const user = store.db().users.find((u) => u.id === sellerId);
    if (!user) return settings().storeName;
    if (user.role === "admin") return settings().storeName;
    return (user.shop && user.shop.name) || user.name;
}

function isVisible(p) {
    return p.approved && p.status === "active";
}

function shapeProduct(p, ratings = ratingMap(), extra = false) {
    const r = ratings.get(p.id);
    const shaped = {
        id: p.id,
        name: p.name,
        category: p.category,
        categoryName: categoryName(p.category),
        price: p.price,
        comparePrice: p.comparePrice || 0,
        stock: p.stock,
        description: p.description,
        features: p.features || [],
        images: p.images || [],
        image: (p.images || [])[0] || "",
        sizes: p.sizes || [],
        badge: p.badge || "",
        rating: r ? Math.round((r.sum / r.count) * 10) / 10 : 0,
        reviews: r ? r.count : 0,
        sold: p.sold || 0,
        seller: sellerName(p.sellerId),
        createdAt: p.createdAt
    };
    if (extra) {
        // management fields, only for admin / owner views
        shaped.sellerId = p.sellerId;
        shaped.status = p.status;
        shaped.approved = p.approved;
        shaped.rejectReason = p.rejectReason || "";
        shaped.updatedAt = p.updatedAt;
    }
    return shaped;
}

const IMAGE_OK = /^(https?:\/\/[^\s"'<>]+|\/uploads\/[a-zA-Z0-9._-]+|images\/[a-zA-Z0-9._\/-]+)$/;

/* Validate + normalise product form data. Returns { error } or { value }. */
function cleanProductInput(body, existing = null) {
    const b = body || {};
    const out = {};
    const s = settings();

    const name = line(b.name, 120);
    if (name.length < 3) return { error: "Product name must be at least 3 characters." };
    out.name = name;

    const category = line(b.category, 40);
    if (!s.categories.some((c) => c.slug === category)) return { error: "Please choose a valid category." };
    out.category = category;

    const price = int(b.price, NaN);
    if (!Number.isFinite(price) || price < 1 || price > 10000000) return { error: "Enter a valid price (NPR)." };
    out.price = price;

    const compare = int(b.comparePrice, 0);
    if (compare && compare <= price) return { error: "Original price must be higher than the selling price." };
    out.comparePrice = compare > 0 ? compare : 0;

    const stock = int(b.stock, NaN);
    if (!Number.isFinite(stock) || stock < 0 || stock > 100000) return { error: "Enter a valid stock quantity." };
    out.stock = stock;

    out.description = text(b.description, 4000);
    if (out.description.length < 10) return { error: "Please write a short description (at least 10 characters)." };

    const features = Array.isArray(b.features) ? b.features : String(b.features || "").split("\n");
    out.features = features.map((f) => line(f, 160)).filter(Boolean).slice(0, 10);

    const images = (Array.isArray(b.images) ? b.images : []).map((i) => String(i).trim()).filter(Boolean);
    if (images.length === 0) return { error: "Add at least one product image." };
    if (images.length > 6) return { error: "You can add up to 6 images." };
    if (!images.every((i) => IMAGE_OK.test(i))) return { error: "One of the image links is not valid." };
    out.images = images;

    const sizes = Array.isArray(b.sizes) ? b.sizes : String(b.sizes || "").split(",");
    out.sizes = [...new Set(sizes.map((z) => line(z, 12)).filter(Boolean))].slice(0, 20);

    out.badge = line(b.badge, 12);

    return { value: out };
}

/* =========================================================
   COUPONS
========================================================= */

function evaluateCoupon(code, subtotal) {
    const clean = line(code, 40).toUpperCase();
    if (!clean) return { error: "Enter a coupon code." };

    const coupon = store.db().coupons.find((c) => c.code === clean);
    if (!coupon || !coupon.active) return { error: "This coupon code is not valid." };
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { error: "This coupon has expired." };
    if (coupon.usageLimit && coupon.used >= coupon.usageLimit) return { error: "This coupon has been fully used." };
    if (coupon.minOrder && subtotal < coupon.minOrder) {
        return { error: `Add items worth NPR ${coupon.minOrder.toLocaleString("en-IN")} or more to use this coupon.` };
    }

    let discount = coupon.type === "percent" ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
    if (coupon.type === "percent" && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.max(0, Math.min(discount, subtotal));

    return { coupon, discount };
}

/* =========================================================
   ORDERS
========================================================= */

function deriveStatus(items) {
    const all = new Set(items.map((i) => i.status));
    if (all.size === 1) return [...all][0];
    const active = new Set(items.filter((i) => i.status !== "cancelled").map((i) => i.status));
    if (active.size === 1) return [...active][0];
    return "processing";
}

function newOrderId() {
    const d = new Date();
    const stamp =
        String(d.getFullYear()).slice(2) +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
    let id;
    do {
        id = `SE-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    } while (store.db().orders.some((o) => o.id === id));
    return id;
}

function restoreStock(items) {
    for (const item of items) {
        const product = store.db().products.find((p) => p.id === item.productId);
        if (product) {
            product.stock += item.quantity;
            product.sold = Math.max(0, (product.sold || 0) - item.quantity);
        }
    }
}

function addTimeline(order, note, by) {
    order.status = deriveStatus(order.items);
    order.timeline.push({ status: order.status, at: new Date().toISOString(), note: note || "", by: by || "" });
    order.updatedAt = new Date().toISOString();
}

/* Set the status of some items; handles stock restore + COD payment. */
function setItemsStatus(order, predicate, status, by, note) {
    let changed = 0;
    const cancelled = [];
    for (const item of order.items) {
        if (!predicate(item)) continue;
        if (FINAL_STATUSES.includes(item.status)) continue;
        if (item.status === status) continue;
        item.status = status;
        changed += 1;
        if (status === "cancelled") cancelled.push(item);
    }
    if (!changed) return 0;
    if (cancelled.length) restoreStock(cancelled);
    addTimeline(order, note, by);
    // cash on delivery is collected on delivery
    if (order.status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "pending") {
        order.paymentStatus = "paid";
    }
    return changed;
}

function orderView(order, sellerId = null) {
    const items = sellerId ? order.items.filter((i) => i.sellerId === sellerId) : order.items;
    const view = {
        id: order.id,
        status: sellerId ? deriveStatus(items) : order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentRef: order.paymentRef || "",
        customer: order.customer,
        shipping: order.shipping,
        notes: order.notes || "",
        items,
        subtotal: sellerId ? items.reduce((s, i) => s + i.price * i.quantity, 0) : order.subtotal,
        discount: sellerId ? 0 : order.discount,
        couponCode: order.couponCode || "",
        shippingFee: sellerId ? 0 : order.shippingFee,
        total: sellerId ? items.reduce((s, i) => s + i.price * i.quantity, 0) : order.total,
        timeline: order.timeline,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
    };
    if (!sellerId) view.userId = order.userId || null;
    return view;
}

module.exports = {
    ITEM_STATUSES,
    FINAL_STATUSES,
    settings,
    publicSettings,
    categoryName,
    ratingMap,
    sellerName,
    isVisible,
    shapeProduct,
    cleanProductInput,
    evaluateCoupon,
    deriveStatus,
    newOrderId,
    restoreStock,
    addTimeline,
    setItemsStatus,
    orderView
};
