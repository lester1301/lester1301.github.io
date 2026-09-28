/*
 * Sends transactional email through Resend or Brevo's HTTP API using the
 * built-in fetch (Node 18+). No email is sent, and nothing crashes, if no
 * provider is configured — it just logs to the console, exactly like the
 * AI assistant does when GEMINI_API_KEY is missing.
 *
 * Configure with:
 *   EMAIL_PROVIDER=resend        EMAIL_API_KEY=re_xxx        EMAIL_FROM="ShopEase <orders@yourdomain.com>"
 *   EMAIL_PROVIDER=brevo         EMAIL_API_KEY=xkeysib-xxx   EMAIL_FROM="orders@yourdomain.com"
 *
 * Both Resend and Brevo require the "from" address's domain to be verified
 * with them before it will actually deliver — check their dashboards.
 */
const PROVIDER = (process.env.EMAIL_PROVIDER || "").toLowerCase();
const API_KEY = process.env.EMAIL_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "ShopEase <no-reply@example.com>";

const enabled = !!(PROVIDER && API_KEY);
if (!enabled) {
    console.warn("[email] EMAIL_PROVIDER / EMAIL_API_KEY not set. Emails will be logged to the console instead of sent.");
}

async function send({ to, subject, html, text }) {
    if (!to) return { ok: false, skipped: true };
    if (!enabled) {
        console.log(`[email] (not sent, no provider configured) To: ${to} | Subject: ${subject}`);
        return { ok: false, skipped: true };
    }
    try {
        if (PROVIDER === "resend") {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
            });
            if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
        } else if (PROVIDER === "brevo") {
            const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: { "api-key": API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ sender: { email: FROM }, to: [{ email: to }], subject, htmlContent: html, textContent: text })
            });
            if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${await res.text()}`);
        } else {
            console.warn(`[email] Unknown EMAIL_PROVIDER "${PROVIDER}". Use "resend" or "brevo".`);
            return { ok: false, skipped: true };
        }
        return { ok: true };
    } catch (error) {
        console.error("[email] Failed to send:", error.message);
        return { ok: false, error: error.message };
    }
}

/* ---------- simple, inline-styled templates ---------- */

function layout(storeName, title, bodyHtml) {
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#23243a">
        <div style="background:#10201d;padding:20px 28px;border-radius:12px 12px 0 0"><span style="color:#fff;font-size:20px;font-weight:800">${storeName}</span></div>
        <div style="border:1px solid #e8e8f1;border-top:0;border-radius:0 0 12px 12px;padding:28px">
            <h2 style="margin:0 0 14px;color:#10201d">${title}</h2>
            ${bodyHtml}
            <p style="margin-top:28px;color:#6a6b82;font-size:13px">This is an automated message from ${storeName}.</p>
        </div></div>`;
}

async function orderConfirmation(order, storeName) {
    const rows = order.items
        .map((i) => `<tr><td style="padding:6px 0">${i.name}${i.size ? " (Size " + i.size + ")" : ""} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">NPR ${(i.price * i.quantity).toLocaleString("en-IN")}</td></tr>`)
        .join("");
    const body = `<p>Hi ${order.customer.name.split(" ")[0]}, thanks for your order! Here's a summary:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
        <tr><td style="padding-top:10px;border-top:1px solid #e8e8f1;font-weight:700">Total</td><td style="padding-top:10px;border-top:1px solid #e8e8f1;text-align:right;font-weight:700">NPR ${order.total.toLocaleString("en-IN")}</td></tr></table>
        <p><b>Order number:</b> ${order.id}<br><b>Payment:</b> ${order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment"}<br><b>Delivering to:</b> ${order.shipping.address}, ${order.shipping.city}</p>
        <p>You can track your order any time on our Track Order page using this order number.</p>`;
    return send({ to: order.customer.email, subject: `Order confirmed: ${order.id}`, html: layout(storeName, "Your order is confirmed", body), text: `Order ${order.id} confirmed. Total NPR ${order.total}.` });
}

async function passwordReset(user, resetUrl, storeName) {
    const body = `<p>Hi ${user.name.split(" ")[0]}, we received a request to reset your password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Reset password</a></p>
        <p style="color:#6a6b82;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`;
    return send({ to: user.email, subject: "Reset your password", html: layout(storeName, "Reset your password", body), text: `Reset your password: ${resetUrl}` });
}

async function sellerApproved(user, storeUrl, storeName) {
    const body = `<p>Hi ${user.name.split(" ")[0]}, good news — your seller account has been approved!</p>
        <p>You can now sign in and start adding products.</p>
        <p><a href="${storeUrl}" style="display:inline-block;background:#10201d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Go to seller dashboard</a></p>`;
    return send({ to: user.email, subject: "Your seller account was approved", html: layout(storeName, "You're approved to sell", body), text: "Your seller account was approved." });
}

async function backInStock(user, product, url, storeName) {
    const body = `<p>Hi ${user.name.split(" ")[0]}, an item on your wishlist is back in stock:</p>
        <p style="font-weight:700;font-size:16px">${product.name} — NPR ${product.price.toLocaleString("en-IN")}</p>
        <p><a href="${url}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">View product</a></p>`;
    return send({ to: user.email, subject: `Back in stock: ${product.name}`, html: layout(storeName, "Back in stock!", body), text: `${product.name} is back in stock.` });
}

module.exports = { enabled, send, orderConfirmation, passwordReset, sellerApproved, backInStock };
