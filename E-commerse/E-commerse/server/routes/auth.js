const crypto = require("crypto");
const express = require("express");
const store = require("../lib/store");
const shop = require("../lib/shop");
const email = require("../lib/email");
const totp = require("../lib/totp");
const {
    hashPassword, verifyPassword, signToken, verifyToken, requireAuth, rateLimit,
    ok, fail, line, EMAIL_RE, PHONE_RE, publicUser
} = require("../lib/util");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60000, max: 12 });

router.post("/register", limiter, async (req, res) => {
    const db = store.db();
    const b = req.body || {};

    const name = line(b.name, 80);
    const email = line(b.email, 120).toLowerCase();
    const phone = line(b.phone, 18);
    const password = String(b.password || "");
    const wantsSeller = b.role === "seller";

    if (name.length < 2) return fail(res, 400, "Please enter your full name.");
    if (!EMAIL_RE.test(email)) return fail(res, 400, "Please enter a valid email address.");
    if (phone && !PHONE_RE.test(phone)) return fail(res, 400, "Please enter a valid phone number.");
    if (password.length < 8) return fail(res, 400, "Password must be at least 8 characters.");
    if (password.length > 100) return fail(res, 400, "Password is too long.");
    if (db.users.some((u) => u.email === email)) return fail(res, 409, "An account with this email already exists. Try signing in.");

    let shop = null;
    if (wantsSeller) {
        const shopName = line(b.shopName, 80);
        if (shopName.length < 2) return fail(res, 400, "Please enter your shop name.");
        if (!phone) return fail(res, 400, "Sellers must add a phone number.");
        shop = { name: shopName, description: line(b.shopDescription, 300), address: line(b.shopAddress, 200) };
    }

    const user = {
        id: store.uid(),
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        role: wantsSeller ? "seller" : "customer",
        status: wantsSeller ? "pending" : "active", // sellers wait for admin approval
        shop,
        addresses: [],
        wishlist: [],
        createdAt: new Date().toISOString()
    };
    db.users.push(user);
    store.save();

    ok(res, { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
});

router.post("/login", limiter, async (req, res) => {
    const emailAddr = line(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    const user = store.db().users.find((u) => u.email === emailAddr);
    const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "s1$00$00");
    if (!user || !valid) return fail(res, 401, "Incorrect email or password.");
    if (user.status === "blocked") return fail(res, 403, "This account has been blocked. Please contact support.");

    if (user.totpEnabled) {
        return ok(res, { twoFactorRequired: true, tempToken: signToken({ sub: user.id, purpose: "2fa" }, 300) });
    }
    ok(res, { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
});

router.post("/2fa/verify-login", limiter, (req, res) => {
    const payload = verifyToken(req.body.tempToken);
    if (!payload || payload.purpose !== "2fa") return fail(res, 401, "This sign-in attempt has expired. Please sign in again.");
    const user = store.db().users.find((u) => u.id === payload.sub);
    if (!user || !user.totpEnabled) return fail(res, 401, "Please sign in again.");
    if (user.status === "blocked") return fail(res, 403, "This account has been blocked. Please contact support.");
    if (!totp.verify(user.totpSecret, req.body.code)) return fail(res, 400, "That code is incorrect or has expired.");
    ok(res, { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => ok(res, { user: publicUser(req.user) }));

/* ---------- forgot / reset password ---------- */

const forgotLimiter = rateLimit({ windowMs: 60000, max: 5 });

router.post("/forgot", forgotLimiter, async (req, res) => {
    const emailAddr = line(req.body.email, 120).toLowerCase();
    const origin = line(req.body.origin, 200); // the site's own URL, e.g. https://lester1301.github.io/E-commerse
    const user = store.db().users.find((u) => u.email === emailAddr);

    // Always respond the same way, whether or not the account exists, so emails can't be enumerated.
    if (user) {
        const token = crypto.randomBytes(32).toString("base64url");
        user.resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
        user.resetExpires = new Date(Date.now() + 3600 * 1000).toISOString();
        store.save();
        const safeOrigin = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?(\/[a-zA-Z0-9_-]+)*$/.test(origin) ? origin : "";
        const resetUrl = `${safeOrigin || ""}/reset.html?token=${token}`;
        email.passwordReset(user, resetUrl, shop.settings().storeName).catch(() => {});
    }
    ok(res, { message: "If an account exists with that email, we've sent a password reset link." });
});

router.post("/reset", forgotLimiter, async (req, res) => {
    const token = line(req.body.token, 200);
    const password = String(req.body.password || "");
    if (!token) return fail(res, 400, "This reset link is invalid.");
    if (password.length < 8) return fail(res, 400, "Password must be at least 8 characters.");

    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const user = store.db().users.find((u) => u.resetTokenHash === hash);
    if (!user || !user.resetExpires || new Date(user.resetExpires) < new Date()) {
        return fail(res, 400, "This reset link is invalid or has expired. Please request a new one.");
    }

    user.passwordHash = await hashPassword(password);
    delete user.resetTokenHash;
    delete user.resetExpires;
    store.save();
    ok(res, { message: "Your password has been reset. You can now sign in." });
});

/* ---------- two-factor authentication (admin accounts) ---------- */

router.post("/2fa/setup", requireAuth, (req, res) => {
    if (req.user.role !== "admin") return fail(res, 403, "Two-factor authentication is available for admin accounts.");
    const secret = totp.randomBase32Secret();
    req.user.pendingTotpSecret = secret; // not active until confirmed with a code
    store.save();
    const otpauth = totp.otpauthUrl(secret, req.user.email, shop.settings().storeName);
    ok(res, { secret, otpauth, qrImage: totp.qrImageUrl(otpauth) });
});

router.post("/2fa/enable", requireAuth, (req, res) => {
    if (!req.user.pendingTotpSecret) return fail(res, 400, "Please start setup again.");
    if (!totp.verify(req.user.pendingTotpSecret, req.body.code)) return fail(res, 400, "That code is incorrect. Check your authenticator app and try again.");
    req.user.totpSecret = req.user.pendingTotpSecret;
    req.user.totpEnabled = true;
    delete req.user.pendingTotpSecret;
    store.save();
    ok(res, { message: "Two-factor authentication is now on." });
});

router.post("/2fa/disable", requireAuth, async (req, res) => {
    if (!(await verifyPassword(String(req.body.password || ""), req.user.passwordHash))) return fail(res, 400, "Your password is incorrect.");
    req.user.totpEnabled = false;
    delete req.user.totpSecret;
    delete req.user.pendingTotpSecret;
    store.save();
    ok(res, { message: "Two-factor authentication is now off." });
});

router.put("/password", requireAuth, limiter, async (req, res) => {
    const current = String(req.body.current || "");
    const next = String(req.body.next || "");
    if (!(await verifyPassword(current, req.user.passwordHash))) return fail(res, 400, "Your current password is incorrect.");
    if (next.length < 8) return fail(res, 400, "New password must be at least 8 characters.");
    if (next.length > 100) return fail(res, 400, "Password is too long.");
    req.user.passwordHash = await hashPassword(next);
    store.save();
    ok(res, { message: "Password updated." });
});

module.exports = router;
