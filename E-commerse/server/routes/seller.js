const express = require("express");
const store = require("../lib/store");
const shop = require("../lib/shop");
const { dailySeries } = require("../lib/stats");
const { requireRole, ok, fail, line, int, PHONE_RE, publicUser } = require("../lib/util");

const router = express.Router();
router.use(requireRole("seller"));

/* Only approved sellers may manage products and orders. */
function requireApproved(req, res, next) {
    if (req.user.status !== "active") {
        return fail(res, 403, "Your seller account is waiting for approval. You will be able to add products once the store team approves it.");
    }
    next();
}

const mine = (req) => store.db().products.filter((p) => p.sellerId === req.user.id);

/* =========================================================
   DASHBOARD
========================================================= */

router.get("/stats", (req, res) => {
    const db = store.db();
    const s = shop.settings();
    const products = mine(req);

    const rows = [];
    for (const order of db.orders) {
        const items = order.items.filter((i) => i.sellerId === req.user.id && i.status !== "cancelled");
        if (items.length) rows.push({ order, items, amount: items.reduce((sum, i) => sum + i.price * i.quantity, 0) });
    }

    const gross = rows.reduce((sum, r) => sum + r.amount, 0);
    const delivered = db.orders.reduce(
        (sum, o) =>
            sum + o.items.filter((i) => i.sellerId === req.user.id && i.status === "delivered").reduce((x, i) => x + i.price * i.quantity, 0),
        0
    );
    const commission = s.commissionPercent || 0;

    const pendingItems = db.orders.filter((o) => o.items.some((i) => i.sellerId === req.user.id && ["pending", "confirmed"].includes(i.status))).length;

    ok(res, {
        status: req.user.status,
        commissionPercent: commission,
        stats: {
            grossSales: gross,
            deliveredSales: delivered,
            earnings: Math.round(delivered * (1 - commission / 100)),
            orders: rows.length,
            toFulfil: pendingItems,
            products: products.length,
            activeProducts: products.filter(shop.isVisible).length,
            pendingApproval: products.filter((p) => p.status === "pending").length
        },
        lowStock: products.filter((p) => p.stock <= s.lowStockAt && p.status !== "archived").map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
        chart: dailySeries(rows.map((r) => ({ at: r.order.createdAt, amount: r.amount })), 14),
        recent: rows
            .slice(-6)
            .reverse()
            .map((r) => ({ id: r.order.id, customer: r.order.customer.name, total: r.amount, status: shop.deriveStatus(r.items), createdAt: r.order.createdAt }))
    });
});

/* =========================================================
   PRODUCTS
========================================================= */

router.get("/products", (req, res) => {
    const ratings = shop.ratingMap();
    ok(res, { products: mine(req).map((p) => shop.shapeProduct(p, ratings, true)).sort((a, b) => b.id - a.id) });
});

router.post("/products", requireApproved, (req, res) => {
    const result = shop.cleanProductInput(req.body);
    if (result.error) return fail(res, 400, result.error);

    const auto = shop.settings().autoApproveProducts;
    const now = new Date().toISOString();
    const product = {
        id: store.nextProductId(),
        sellerId: req.user.id,
        ...result.value,
        status: auto ? "active" : "pending",
        approved: !!auto,
        rejectReason: "",
        sold: 0,
        createdAt: now,
        updatedAt: now
    };
    store.db().products.push(product);
    store.save();
    ok(res, {
        product: shop.shapeProduct(product, shop.ratingMap(), true),
        message: auto ? "Product published." : "Product submitted. It will go live after the store team approves it."
    });
});

router.put("/products/:id", requireApproved, (req, res) => {
    const product = mine(req).find((p) => p.id === int(req.params.id));
    if (!product) return fail(res, 404, "Product not found.");

    const result = shop.cleanProductInput(req.body, product);
    if (result.error) return fail(res, 400, result.error);
    Object.assign(product, result.value);

    // sellers can only switch approved products between live and draft
    if (product.approved) {
        product.status = req.body.status === "draft" ? "draft" : "active";
    } else {
        product.status = "pending";
        product.rejectReason = "";
    }
    product.updatedAt = new Date().toISOString();
    store.save();
    ok(res, { product: shop.shapeProduct(product, shop.ratingMap(), true), message: "Product saved." });
});

router.delete("/products/:id", requireApproved, (req, res) => {
    const db = store.db();
    const product = mine(req).find((p) => p.id === int(req.params.id));
    if (!product) return fail(res, 404, "Product not found.");

    const hasOrders = db.orders.some((o) => o.items.some((i) => i.productId === product.id));
    if (hasOrders) {
        product.status = "archived"; // keep history intact
        product.updatedAt = new Date().toISOString();
    } else {
        db.products = db.products.filter((p) => p.id !== product.id);
    }
    store.save();
    ok(res, { message: hasOrders ? "Product archived (it has past orders)." : "Product deleted." });
});

/* =========================================================
   ORDERS
========================================================= */

router.get("/orders", (req, res) => {
    const orders = store
        .db()
        .orders.filter((o) => o.items.some((i) => i.sellerId === req.user.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((o) => shop.orderView(o, req.user.id));
    ok(res, { orders });
});

router.put("/orders/:id/status", requireApproved, (req, res) => {
    const status = String(req.body.status || "");
    if (!shop.ITEM_STATUSES.includes(status) || status === "pending") return fail(res, 400, "Choose a valid status.");

    const order = store.db().orders.find((o) => o.id === req.params.id);
    if (!order || !order.items.some((i) => i.sellerId === req.user.id)) return fail(res, 404, "Order not found.");

    const changed = shop.setItemsStatus(order, (i) => i.sellerId === req.user.id, status, "seller", `Seller marked items as ${status}`);
    if (!changed) return fail(res, 400, "Nothing to update. These items may already be delivered or cancelled.");
    store.save();
    ok(res, { order: shop.orderView(order, req.user.id) });
});

/* =========================================================
   SHOP PROFILE
========================================================= */

router.put("/profile", (req, res) => {
    const name = line(req.body.name, 80);
    const phone = line(req.body.phone, 18);
    const shopName = line(req.body.shopName, 80);
    if (name.length < 2 || shopName.length < 2) return fail(res, 400, "Please enter your name and shop name.");
    if (phone && !PHONE_RE.test(phone)) return fail(res, 400, "Please enter a valid phone number.");

    req.user.name = name;
    req.user.phone = phone;
    req.user.shop = {
        name: shopName,
        description: line(req.body.shopDescription, 300),
        address: line(req.body.shopAddress, 200)
    };
    store.save();
    ok(res, { user: publicUser(req.user), message: "Shop profile saved." });
});

module.exports = router;
