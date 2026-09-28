/*
 * eSewa and Khalti integration for Nepal.
 *
 * Both work with the PUBLIC TEST credentials below out of the box, so you can
 * test the full flow before going live. Switch to your real merchant
 * credentials with environment variables when you're ready to accept real
 * payments — see the .env.example file.
 *
 * eSewa (EPay v2): https://developer.esewa.com.np/
 *   The signature is computed locally (HMAC-SHA256) — no server-to-server
 *   call is needed to start a payment, only to redirect the browser.
 *
 * Khalti (ePayment / KPG-2): https://docs.khalti.com/
 *   Starting a payment requires one server-to-server call to Khalti, which
 *   needs internet access from wherever this server is deployed.
 */
const crypto = require("crypto");

const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || "EPAYTEST";
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
const ESEWA_GATEWAY_URL = process.env.ESEWA_GATEWAY_URL || "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || "test_secret_key_dc74e0fd57cb46cd93832aee0a390234";
const KHALTI_API_BASE = process.env.KHALTI_API_BASE || "https://dev.khalti.com/api/v2";

const usingTestCreds = {
    esewa: !process.env.ESEWA_MERCHANT_CODE,
    khalti: !process.env.KHALTI_SECRET_KEY
};

/* ---------------------------------------------------------
   ESEWA
--------------------------------------------------------- */

/* Build the auto-submitting form fields the browser POSTs to eSewa. */
function esewaInitiate({ orderId, amount, successUrl, failureUrl }) {
    const fields = {
        amount: String(amount),
        tax_amount: "0",
        total_amount: String(amount),
        transaction_uuid: orderId,
        product_code: ESEWA_MERCHANT_CODE,
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: "total_amount,transaction_uuid,product_code"
    };
    const message = `total_amount=${fields.total_amount},transaction_uuid=${fields.transaction_uuid},product_code=${fields.product_code}`;
    fields.signature = crypto.createHmac("sha256", ESEWA_SECRET_KEY).update(message).digest("base64");
    return { gatewayUrl: ESEWA_GATEWAY_URL, fields };
}

/* eSewa redirects back with ?data=<base64 JSON>. Decode + verify the signature locally. */
function esewaDecode(data) {
    try {
        const json = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
        const fieldNames = (json.signed_field_names || "").split(",");
        const message = fieldNames.map((f) => `${f}=${json[f]}`).join(",");
        const expected = crypto.createHmac("sha256", ESEWA_SECRET_KEY).update(message).digest("base64");
        return { ok: expected === json.signature && json.status === "COMPLETE", payload: json };
    } catch (e) {
        return { ok: false, error: "Could not read eSewa's response." };
    }
}

/* ---------------------------------------------------------
   KHALTI
--------------------------------------------------------- */

async function khaltiInitiate({ orderId, amount, returnUrl, name, email, phone }) {
    const res = await fetch(`${KHALTI_API_BASE}/epayment/initiate/`, {
        method: "POST",
        headers: { Authorization: `Key ${KHALTI_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            return_url: returnUrl,
            website_url: new URL(returnUrl).origin,
            amount: Math.round(amount * 100), // paisa
            purchase_order_id: orderId,
            purchase_order_name: `Order ${orderId}`,
            customer_info: { name, email, phone }
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Khalti could not start this payment.");
    return data; // { pidx, payment_url, ... }
}

async function khaltiVerify(pidx) {
    const res = await fetch(`${KHALTI_API_BASE}/epayment/lookup/`, {
        method: "POST",
        headers: { Authorization: `Key ${KHALTI_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pidx })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not verify this payment with Khalti.");
    return { ok: data.status === "Completed", payload: data };
}

module.exports = { esewaInitiate, esewaDecode, khaltiInitiate, khaltiVerify, usingTestCreds };
