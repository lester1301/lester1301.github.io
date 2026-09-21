const express = require("express");
const store = require("../lib/store");
const {
    hashPassword, verifyPassword, signToken, requireAuth, rateLimit,
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
    const email = line(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");

    const user = store.db().users.find((u) => u.email === email);
    const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "s1$00$00");
    if (!user || !valid) return fail(res, 401, "Incorrect email or password.");
    if (user.status === "blocked") return fail(res, 403, "This account has been blocked. Please contact support.");

    ok(res, { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => ok(res, { user: publicUser(req.user) }));

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
