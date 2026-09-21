require("dotenv").config({ quiet: true });

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");

const store = require("./lib/store");
const { attachUser, requireRole, rateLimit, ok, fail } = require("./lib/util");
const { seed } = require("./seed");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.disable("x-powered-by");

/* =========================================================
   MIDDLEWARE
========================================================= */

// Set ALLOWED_ORIGINS="https://lester1301.github.io" to lock the API to your site.
const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: allowed.length ? allowed : true
    })
);

app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    next();
});

const smallJson = express.json({ limit: "100kb" });
// the upload route has its own, larger body limit
app.use((req, res, next) => (req.path === "/api/upload" ? next() : smallJson(req, res, next)));
app.use(attachUser);

/* =========================================================
   UPLOADS (product images)
========================================================= */

const UPLOAD_DIR = path.join(store.DATA_DIR, "uploads");
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true, dotfiles: "deny" }));

const IMAGE_TYPES = {
    "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
    "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
    "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] }
};

app.post(
    "/api/upload",
    requireRole("seller", "admin"),
    rateLimit({ max: 40 }),
    express.json({ limit: "3mb" }),
    (req, res) => {
        const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data || ""));
        if (!match) return fail(res, 400, "Please upload a JPG, PNG or WebP image.");

        const type = IMAGE_TYPES[match[1]];
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length > 2 * 1024 * 1024) return fail(res, 400, "Image is too large (max 2 MB).");
        if (!type.magic.every((byte, i) => buffer[i] === byte)) return fail(res, 400, "That file is not a valid image.");

        const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}.${type.ext}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
        ok(res, { url: `/uploads/${name}` });
    }
);

/* =========================================================
   API ROUTES
========================================================= */

app.get("/api/health", (req, res) => ok(res, { message: "ShopEase server is running.", time: new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/account", require("./routes/account"));
app.use("/api/seller", require("./routes/seller"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api", require("./routes/public"));

app.get("/", (req, res, next) => {
    if (process.env.SERVE_FRONTEND === "1") return next();
    ok(res, { message: "ShopEase server is running!" });
});

/* =========================================================
   OPTIONAL: serve the website from this same server (local development)
   Run with SERVE_FRONTEND=1 npm start  ->  http://localhost:3000
========================================================= */

if (process.env.SERVE_FRONTEND === "1") {
    const root = path.join(__dirname, "..");
    app.use((req, res, next) => {
        if (/^\/server(\/|$)/i.test(req.path) || /\/\./.test(req.path)) return fail(res, 404, "Not found.");
        next();
    });
    app.use(express.static(root, { dotfiles: "deny", extensions: ["html"] }));
}

/* =========================================================
   ERRORS
========================================================= */

app.use("/api", (req, res) => fail(res, 404, "Not found."));

app.use((err, req, res, next) => {
    if (err && err.type === "entity.too.large") return fail(res, 413, "That request is too large.");
    if (err && err.type === "entity.parse.failed") return fail(res, 400, "Invalid request body.");
    console.error("[server] Unhandled error:", err);
    fail(res, 500, "Something went wrong. Please try again.");
});

/* =========================================================
   START
========================================================= */

seed()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`ShopEase server running on port ${PORT}`);
            console.log(`Data folder: ${store.DATA_DIR}`);
        });
    })
    .catch((error) => {
        console.error("Failed to start:", error);
        process.exit(1);
    });
