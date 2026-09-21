const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const store = require("./store");

const scrypt = promisify(crypto.scrypt);

/* =========================================================
   PASSWORDS (scrypt, no extra dependency)
========================================================= */

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    return `s1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
    try {
        const [version, saltHex, hashHex] = String(stored).split("$");
        if (version !== "s1") return false;
        const expected = Buffer.from(hashHex, "hex");
        const actual = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch (e) {
        return false;
    }
}

/* =========================================================
   JWT (HS256)
========================================================= */

function loadSecret() {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
        return process.env.JWT_SECRET;
    }
    const file = path.join(store.DATA_DIR, "jwt.secret");
    try {
        return fs.readFileSync(file, "utf8").trim();
    } catch (e) {
        const secret = crypto.randomBytes(48).toString("hex");
        fs.writeFileSync(file, secret, { mode: 0o600 });
        console.warn("[auth] JWT_SECRET is not set. A random secret was generated. Set JWT_SECRET in your environment so logins survive redeploys.");
        return secret;
    }
}

const SECRET = loadSecret();

const b64u = (value) => Buffer.from(value).toString("base64url");

function signToken(payload, ttlSeconds = 7 * 24 * 3600) {
    const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
    const sig = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
    return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
    try {
        const [header, body, sig] = String(token).split(".");
        if (!header || !body || !sig) return null;
        const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest();
        const given = Buffer.from(sig, "base64url");
        if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (!payload.exp || payload.exp < Date.now() / 1000) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

/* =========================================================
   MIDDLEWARE
========================================================= */

function attachUser(req, res, next) {
    const header = req.headers.authorization || "";
    if (header.startsWith("Bearer ")) {
        const payload = verifyToken(header.slice(7));
        if (payload) {
            const user = store.db().users.find((u) => u.id === payload.sub);
            if (user && user.status !== "blocked") req.user = user;
        }
    }
    next();
}

function requireAuth(req, res, next) {
    if (!req.user) return fail(res, 401, "Please sign in to continue.");
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return fail(res, 401, "Please sign in to continue.");
        if (!roles.includes(req.user.role)) return fail(res, 403, "You do not have access to this area.");
        next();
    };
}

function rateLimit({ windowMs = 60000, max = 30 } = {}) {
    const hits = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) if (entry.reset < now) hits.delete(key);
    }, windowMs).unref();

    return (req, res, next) => {
        const now = Date.now();
        let entry = hits.get(req.ip);
        if (!entry || entry.reset < now) {
            entry = { count: 0, reset: now + windowMs };
            hits.set(req.ip, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
            return fail(res, 429, "Too many requests. Please wait a minute and try again.");
        }
        next();
    };
}

/* =========================================================
   RESPONSES + CLEANING
========================================================= */

function ok(res, data = {}) {
    return res.json({ success: true, ...data });
}

function fail(res, status, message, extra = {}) {
    return res.status(status).json({ success: false, message, ...extra });
}

function line(value, max = 200) {
    return String(value ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

function text(value, max = 4000) {
    return String(value ?? "")
        .replace(/\r/g, "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\-\s()]{7,18}$/;

function int(value, fallback = 0) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
}

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        status: user.status,
        shop: user.shop || null,
        createdAt: user.createdAt
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    signToken,
    verifyToken,
    attachUser,
    requireAuth,
    requireRole,
    rateLimit,
    ok,
    fail,
    line,
    text,
    int,
    EMAIL_RE,
    PHONE_RE,
    publicUser
};
