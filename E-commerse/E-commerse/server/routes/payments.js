const express = require("express");
const store = require("../lib/store");
const shop = require("../lib/shop");
const email = require("../lib/email");
const payments = require("../lib/payments");
const { ok, fail, line, rateLimit } = require("../lib/util");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60000, max: 20 });

function markOrderPaid(order, ref) {
    if (order.paymentStatus === "paid") return;
    order.paymentStatus = "paid";
    order.paymentRef = ref;
    order.timeline.push({ status: order.status, at: new Date().toISOString(), note: "Payment confirmed automatically by the payment gateway", by: "system" });
    order.updatedAt = new Date().toISOString();
    store.save();
}

/* Start a payment. The order must already exist (created via POST /api/orders with paymentMethod "online"). */
router.post("/esewa/initiate", limiter, (req, res) => {
    const order = store.db().orders.find((o) => o.id === line(req.body.orderId, 40));
    if (!order) return fail(res, 404, "Order not found.");
    if (order.paymentStatus === "paid") return fail(res, 400, "This order has already been paid.");

    const origin = line(req.body.origin, 300);
    if (!/^https?:\/\//i.test(origin)) return fail(res, 400, "Invalid request.");

    const { gatewayUrl, fields } = payments.esewaInitiate({
        orderId: order.id,
        amount: order.total,
        successUrl: `${origin}/checkout.html?esewa=success&order=${encodeURIComponent(order.id)}`,
        failureUrl: `${origin}/checkout.html?esewa=failure&order=${encodeURIComponent(order.id)}`
    });
    ok(res, { gatewayUrl, fields });
});

router.post("/esewa/verify", limiter, (req, res) => {
    const result = payments.esewaDecode(req.body.data);
    if (!result.ok) return fail(res, 400, result.error || "Payment could not be verified.");
    const order = store.db().orders.find((o) => o.id === result.payload.transaction_uuid);
    if (!order) return fail(res, 404, "Order not found.");
    markOrderPaid(order, result.payload.transaction_code || result.payload.transaction_uuid);
    email.orderConfirmation(order, shop.settings().storeName).catch(() => {});
    ok(res, { order: shop.orderView(order) });
});

router.post("/khalti/initiate", limiter, async (req, res) => {
    const order = store.db().orders.find((o) => o.id === line(req.body.orderId, 40));
    if (!order) return fail(res, 404, "Order not found.");
    if (order.paymentStatus === "paid") return fail(res, 400, "This order has already been paid.");

    const origin = line(req.body.origin, 300);
    if (!/^https?:\/\//i.test(origin)) return fail(res, 400, "Invalid request.");

    try {
        const data = await payments.khaltiInitiate({
            orderId: order.id,
            amount: order.total,
            returnUrl: `${origin}/checkout.html?khalti=return&order=${encodeURIComponent(order.id)}`,
            name: order.customer.name,
            email: order.customer.email,
            phone: order.customer.phone
        });
        order.paymentRef = data.pidx;
        store.save();
        ok(res, { paymentUrl: data.payment_url, pidx: data.pidx });
    } catch (error) {
        fail(res, 502, `Khalti error: ${error.message}`);
    }
});

router.post("/khalti/verify", limiter, async (req, res) => {
    const pidx = line(req.body.pidx, 100);
    if (!pidx) return fail(res, 400, "Missing payment reference.");
    try {
        const result = await payments.khaltiVerify(pidx);
        const order = store.db().orders.find((o) => o.paymentRef === pidx);
        if (!order) return fail(res, 404, "Order not found for this payment.");
        if (!result.ok) return fail(res, 400, "Payment was not completed.");
        markOrderPaid(order, pidx);
        email.orderConfirmation(order, shop.settings().storeName).catch(() => {});
        ok(res, { order: shop.orderView(order) });
    } catch (error) {
        fail(res, 502, `Khalti error: ${error.message}`);
    }
});

module.exports = router;
