/*
 * Tiny JSON-file database.
 * - Everything lives in memory, and is written to DATA_DIR/db.json (atomic write).
 * - DATA_DIR must be on a PERSISTENT disk in production (see README).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, "..", "data");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

const FILE = path.join(DATA_DIR, "db.json");

const emptyDb = () => ({
    users: [],
    products: [],
    orders: [],
    coupons: [],
    reviews: [],
    messages: [],
    settings: null,
    counters: { product: 0 }
});

let db;

try {
    db = { ...emptyDb(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
} catch (e) {
    db = emptyDb();
}

let timer = null;

function flush() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
}

function save() {
    if (timer) return;
    timer = setTimeout(flush, 120);
}

function uid() {
    return crypto.randomBytes(8).toString("hex");
}

function nextProductId() {
    db.counters.product = (db.counters.product || 0) + 1;
    return db.counters.product;
}

for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
        try { flush(); } catch (e) { /* ignore */ }
        process.exit(0);
    });
}

module.exports = {
    db: () => db,
    save,
    flush,
    uid,
    nextProductId,
    DATA_DIR
};
