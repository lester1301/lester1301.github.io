const express = require("express");
const store = require("../lib/store");
const shop = require("../lib/shop");
const { requireAuth, ok, fail, line, int, PHONE_RE, publicUser } = require("../lib/util");

const router = express.Router();
router.use(requireAuth);

/* ---------- profile ---------- */

router.get("/", (req, res) => {
    ok(res, {
        user: publicUser(req.user),
        addresses: req.user.addresses || [],
        wishlist: req.user.wishlist || []
    });
});

router.put("/profile", (req, res) => {
    const name = line(req.body.name, 80);
    const phone = line(req.body.phone, 18);
    if (name.length < 2) return fail(res, 400, "Please enter your name.");
    if (phone && !PHONE_RE.test(phone)) return fail(res, 400, "Please enter a valid phone number.");
    req.user.name = name;
    req.user.phone = phone;
    store.save();
    ok(res, { user: publicUser(req.user), message: "Profile updated." });
});

/* ---------- addresses ---------- */

router.post("/addresses", (req, res) => {
    const b = req.body || {};
    const address = {
        id: store.uid(),
        label: line(b.label, 30) || "Home",
        name: line(b.name, 80) || req.user.name,
        phone: line(b.phone, 18) || req.user.phone || "",
        address: line(b.address, 200),
        city: line(b.city, 60),
        postalCode: line(b.postalCode, 12)
    };
    if (address.address.length < 4 || address.city.length < 2) return fail(res, 400, "Please enter the address and city.");
    if (address.phone && !PHONE_RE.test(address.phone)) return fail(res, 400, "Please enter a valid phone number.");

    req.user.addresses = req.user.addresses || [];
    if (req.user.addresses.length >= 8) return fail(res, 400, "You can save up to 8 addresses.");
    req.user.addresses.push(address);
    store.save();
    ok(res, { addresses: req.user.addresses });
});

router.delete("/addresses/:id", (req, res) => {
    req.user.addresses = (req.user.addresses || []).filter((a) => a.id !== req.params.id);
    store.save();
    ok(res, { addresses: req.user.addresses });
});

/* ---------- wishlist (synced) ---------- */

router.get("/wishlist", (req, res) => ok(res, { wishlist: req.user.wishlist || [] }));

router.put("/wishlist", (req, res) => {
    const ids = Array.isArray(req.body.wishlist) ? req.body.wishlist : [];
    req.user.wishlist = [...new Set(ids.map((i) => int(i, 0)).filter((i) => i > 0))].slice(0, 200);
    store.save();
    ok(res, { wishlist: req.user.wishlist });
});

/* ---------- orders ---------- */

router.get("/orders", (req, res) => {
    const orders = store
        .db()
        .orders.filter((o) => o.userId === req.user.id || (!o.userId && o.customer.email === req.user.email))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((o) => shop.orderView(o));
    ok(res, { orders });
});

router.post("/orders/:id/cancel", (req, res) => {
    const order = store
        .db()
        .orders.find((o) => o.id === req.params.id && (o.userId === req.user.id || o.customer.email === req.user.email));
    if (!order) return fail(res, 404, "Order not found.");

    const active = order.items.filter((i) => i.status !== "cancelled");
    if (active.length === 0) return fail(res, 400, "This order is already cancelled.");
    if (active.some((i) => i.status !== "pending")) {
        return fail(res, 400, "This order has already been confirmed or shipped, so it can't be cancelled here. Please contact support.");
    }

    shop.setItemsStatus(order, () => true, "cancelled", "customer", "Cancelled by customer");
    store.save();
    ok(res, { order: shop.orderView(order) });
});

module.exports = router;
