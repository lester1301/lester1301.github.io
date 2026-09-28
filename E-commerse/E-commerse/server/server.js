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
// uploads and backup-restore have their own, larger body limits (set on those routes directly)
const BIG_BODY_ROUTES = ["/api/upload", "/api/admin/restore"];
app.use((req, res, next) => (BIG_BODY_ROUTES.includes(req.path) ? next() : smallJson(req, res, next)));
app.use(attachUser);

/* =========================================================
   UPLOADS (product images)
========================================================= */

// With MongoDB, photos live in the database (they'd vanish from Render's free disk).
// Without it (local development), they are plain files on disk.
const UPLOAD_DIR = path.join(store.DATA_DIR, "uploads");
if (store.usingMongo) {
    app.get("/uploads/:name", async (req, res) => {
        if (!/^[a-z0-9._-]+$/i.test(req.params.name)) return fail(res, 404, "Not found.");
        try {
            const file = await store.getUpload(req.params.name);
            if (!file) return fail(res, 404, "Not found.");
            res.set({ "Content-Type": file.type, "Cache-Control": "public, max-age=2592000, immutable" });
            res.send(file.buffer);
        } catch (error) {
            console.error("[uploads] read failed:", error.message);
            fail(res, 500, "Could not load this image.");
        }
    });
} else {
    app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true, dotfiles: "deny" }));
}

const IMAGE_TYPES = {
    "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
    "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
    "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] }
};

// If set, uploaded images are stored on Cloudinary (survives redeploys with no Disk needed).
// Create a free account, an unsigned upload preset, and set these two variables.
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || "";

app.post(
    "/api/upload",
    requireRole("seller", "admin"),
    rateLimit({ max: 40 }),
    express.json({ limit: "3mb" }),
    async (req, res) => {
        const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data || ""));
        if (!match) return fail(res, 400, "Please upload a JPG, PNG or WebP image.");

        const type = IMAGE_TYPES[match[1]];
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length > 2 * 1024 * 1024) return fail(res, 400, "Image is too large (max 2 MB).");
        if (!type.magic.every((byte, i) => buffer[i] === byte)) return fail(res, 400, "That file is not a valid image.");

        if (CLOUDINARY_CLOUD && CLOUDINARY_PRESET) {
            try {
                const form = new FormData();
                form.append("file", new Blob([buffer], { type: match[1] }));
                form.append("upload_preset", CLOUDINARY_PRESET);
                const cres = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: form });
                const data = await cres.json();
                if (!cres.ok) throw new Error(data.error && data.error.message);
                return ok(res, { url: data.secure_url });
            } catch (error) {
                console.error("[upload] Cloudinary failed, falling back to local disk:", error.message);
            }
        }

        const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}.${type.ext}`;
        try {
            await store.saveUpload(name, buffer, match[1]);
        } catch (error) {
            console.error("[upload] save failed:", error.message);
            return fail(res, 500, "Could not save the image. Please try again.");
        }
        ok(res, { url: `/uploads/${name}` });
    }
);

/* =========================================================
   API ROUTES
========================================================= */

app.get("/api/health", (req, res) => ok(res, { message: "ShopEase server is running.", storage: store.usingMongo ? "mongodb" : "file", time: new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/account", require("./routes/account"));
app.use("/api/seller", require("./routes/seller"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/payments", require("./routes/payments"));
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

store
    .init()
    .then(() => seed())
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`ShopEase server running on port ${PORT}`);
            console.log(store.usingMongo ? "Storage: MongoDB" : `Storage: JSON file in ${store.DATA_DIR} (set MONGODB_URI for production)`);
        });
    })
    .catch((error) => {
        console.error("Failed to start:", error);
        process.exit(1);
    });
