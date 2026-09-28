/* Test helper: a tiny in-memory stand-in for the "mongodb" package that saves to a JSON file,
   so tests can restart the server and prove data really persists. Loaded with: node --require this-file */
const Module = require("module");
const fs = require("fs");

const FILE = process.env.MOCK_MONGO_FILE;

class Binary { constructor(buffer) { this.buffer = Buffer.from(buffer); } }

function readAll() {
    try {
        const raw = JSON.parse(fs.readFileSync(FILE, "utf8"), (k, v) => (v && v.__bin ? new Binary(Buffer.from(v.__bin, "base64")) : v));
        return raw;
    } catch (e) { return {}; }
}
function writeAll(all) {
    fs.writeFileSync(FILE, JSON.stringify(all, (k, v) => (v instanceof Binary ? { __bin: v.buffer.toString("base64") } : v)));
}

class Collection {
    constructor(name) { this.name = name; }
    _docs() { const all = readAll(); return all[this.name] || (all[this.name] = {}); }
    _mutate(fn) { const all = readAll(); all[this.name] = all[this.name] || {}; fn(all[this.name]); writeAll(all); }
    find() { const docs = Object.values(this._docs()); return { toArray: async () => docs }; }
    async findOne({ _id }) { return this._docs()[_id] || null; }
    async replaceOne({ _id }, doc) { this._mutate((d) => { d[_id] = doc; }); }
    async bulkWrite(ops) {
        this._mutate((d) => {
            for (const op of ops) {
                if (op.replaceOne) d[op.replaceOne.filter._id] = op.replaceOne.replacement;
                if (op.deleteOne) delete d[op.deleteOne.filter._id];
            }
        });
    }
}
class MongoClient {
    constructor(uri) { this.uri = uri; }
    async connect() {}
    db() { return { collection: (n) => new Collection(n) }; }
}

const realLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === "mongodb") return { MongoClient, Binary };
    return realLoad.call(this, request, ...rest);
};
