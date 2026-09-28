/*
 * Data store.
 *
 * All routes work on one in-memory object (store.db()). This file decides
 * where that object is saved:
 *
 *   - MONGODB_URI set  -> MongoDB (data survives Render free-plan restarts).
 *   - otherwise        -> a JSON file in DATA_DIR (local development).
 *
 * MongoDB layout (database "shopease" by default):
 *   users, products, orders, coupons, reviews, messages, payouts
 *        one document per record:  { _id, seq, json }
 *   meta      { _id: "settings" | "counters", json }
 *   uploads   { _id: filename, type, data: Binary }   (product photos)
 *
 * Only records that changed since the last save are written.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MONGODB_URI = process.env.MONGODB_URI || "";
const usingMongo = !!MONGODB_URI;

const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, "..", "data");

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!usingMongo) fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

const FILE = path.join(DATA_DIR, "db.json");

/* collection name -> field used as the record id */
const ARRAYS = { users: "id", products: "id", orders: "id", coupons: "code", reviews: "id", messages: "id", payouts: "id" };
const META = ["settings", "counters"];

const emptyDb = () => ({
    users: [],
    products: [],
    orders: [],
    coupons: [],
    reviews: [],
    messages: [],
    payouts: [],
    settings: null,
    counters: { product: 0 }
});

let db = emptyDb();

/* ---------------------------------------------------------
   MongoDB
--------------------------------------------------------- */
let mongo = null;               // { client, database }
const saved = {};               // collection -> Map(id -> json) as last written
const seqOf = {};               // collection -> Map(id -> seq)
let nextSeq = 1;
let metaSaved = {};

async function connectMongo() {
    let driver;
    try {
        driver = require("mongodb");
    } catch (e) {
        throw new Error('MONGODB_URI is set but the "mongodb" package is not installed. Run "npm install" in the server folder.');
    }
    const client = new driver.MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    await client.connect();
    mongo = { client, database: client.db(process.env.MONGODB_DB || "shopease"), Binary: driver.Binary };
}

async function loadFromMongo() {
    const loaded = emptyDb();
    for (const name of Object.keys(ARRAYS)) {
        const docs = await mongo.database.collection(name).find({}).toArray();
        docs.sort((a, b) => a.seq - b.seq);
        saved[name] = new Map();
        seqOf[name] = new Map();
        loaded[name] = docs.map((d) => {
            saved[name].set(d._id, d.json);
            seqOf[name].set(d._id, d.seq);
            nextSeq = Math.max(nextSeq, d.seq + 1);
            return JSON.parse(d.json);
        });
    }
    const meta = await mongo.database.collection("meta").find({}).toArray();
    for (const d of meta) {
        metaSaved[d._id] = d.json;
        loaded[d._id] = JSON.parse(d.json);
    }
    return loaded;
}

async function writeMongo() {
    for (const [name, idField] of Object.entries(ARRAYS)) {
        const current = new Map();
        for (const record of db[name]) current.set(record[idField], JSON.stringify(record));
        const before = saved[name] || (saved[name] = new Map());
        const seqs = seqOf[name] || (seqOf[name] = new Map());

        const ops = [];
        const pending = []; // [id, json, seq] to record after a successful write
        for (const [id, json] of current) {
            if (before.get(id) === json) continue;
            const seq = seqs.get(id) || nextSeq++;
            pending.push([id, json, seq]);
            ops.push({ replaceOne: { filter: { _id: id }, replacement: { _id: id, seq, json }, upsert: true } });
        }
        const removed = [];
        for (const id of before.keys()) {
            if (!current.has(id)) {
                removed.push(id);
                ops.push({ deleteOne: { filter: { _id: id } } });
            }
        }
        if (!ops.length) continue;

        await mongo.database.collection(name).bulkWrite(ops, { ordered: false });
        for (const [id, json, seq] of pending) { before.set(id, json); seqs.set(id, seq); }
        for (const id of removed) { before.delete(id); seqs.delete(id); }
    }

    for (const key of META) {
        if (db[key] === null || db[key] === undefined) continue;
        const json = JSON.stringify(db[key]);
        if (metaSaved[key] === json) continue;
        await mongo.database.collection("meta").replaceOne({ _id: key }, { _id: key, json }, { upsert: true });
        metaSaved[key] = json;
    }
}

/* ---------------------------------------------------------
   Init / save / flush
--------------------------------------------------------- */
async function init() {
    if (usingMongo) {
        await connectMongo();
        db = await loadFromMongo();
        return;
    }
    try {
        db = { ...emptyDb(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    } catch (e) {
        db = emptyDb();
    }
}

let timer = null;
let chain = Promise.resolve();

/* Writes everything that changed. Returns a promise; writes never overlap. */
function flush() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    chain = chain.then(async () => {
        try {
            if (usingMongo) {
                await writeMongo();
            } else {
                const tmp = FILE + ".tmp";
                fs.writeFileSync(tmp, JSON.stringify(db));
                fs.renameSync(tmp, FILE);
            }
        } catch (error) {
            console.error("[store] Save failed, will retry in 5s:", error.message);
            if (!timer) timer = setTimeout(flush, 5000);
        }
    });
    return chain;
}

function save() {
    if (timer) return;
    timer = setTimeout(flush, 120);
}

/* Replace the whole database (backup restore). */
function replace(newDb) {
    db = { ...emptyDb(), ...newDb };
    return flush();
}

function uid() {
    return crypto.randomBytes(8).toString("hex");
}

function nextProductId() {
    db.counters.product = (db.counters.product || 0) + 1;
    return db.counters.product;
}

/* ---------------------------------------------------------
   Uploaded product photos
--------------------------------------------------------- */
async function saveUpload(name, buffer, mime) {
    if (usingMongo) {
        await mongo.database.collection("uploads").replaceOne(
            { _id: name },
            { _id: name, type: mime, data: new mongo.Binary(buffer), createdAt: new Date() },
            { upsert: true }
        );
        return;
    }
    fs.writeFileSync(path.join(DATA_DIR, "uploads", name), buffer);
}

async function getUpload(name) {
    if (!usingMongo) return null; // files are served straight from disk
    const doc = await mongo.database.collection("uploads").findOne({ _id: name });
    if (!doc) return undefined;
    return { type: doc.type, buffer: Buffer.from(doc.data.buffer) };
}

for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
        flush().finally(() => process.exit(0));
    });
}

module.exports = {
    db: () => db,
    init,
    save,
    flush,
    replace,
    uid,
    nextProductId,
    saveUpload,
    getUpload,
    usingMongo,
    DATA_DIR
};
