/* Proves MongoDB mode saves everything and survives a full server restart.
   Uses a stand-in for the mongodb driver (tests/helpers/mock-mongodb.js). */
const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = 3800 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopease-mongo-"));
const mockFile = path.join(dir, "mongo.json");

function start() {
    const child = spawn(process.execPath, ["--require", path.join(__dirname, "helpers", "mock-mongodb.js"), path.join(__dirname, "..", "server.js")], {
        env: { ...process.env, PORT, DATA_DIR: dir, MONGODB_URI: "mongodb://mock", MOCK_MONGO_FILE: mockFile, ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "AdminPass123", JWT_SECRET: "test-secret-test-secret" },
        stdio: "ignore"
    });
    return child;
}
async function ready() {
    for (let i = 0; i < 60; i++) {
        try { const r = await fetch(BASE + "/api/health"); if (r.ok) return r.json(); } catch (e) { /* wait */ }
        await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("server did not start");
}
async function stop(child) {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
}
async function call(method, url, body, token) {
    const res = await fetch(BASE + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

test("data and uploaded photos survive a server restart when MongoDB is used", async () => {
    let child = start();
    const health = await ready();
    assert.equal(health.storage, "mongodb");

    const admin = (await call("POST", "/api/auth/login", { email: "admin@test.local", password: "AdminPass123" })).token;
    const user = await call("POST", "/api/auth/register", { name: "Persist Me", email: "persist@test.local", password: "password123" });
    assert.equal(user.status, 200);

    const products = (await call("GET", "/api/products")).products;
    assert.equal(products.length, 12);
    const plain = products.find((p) => !p.sizes.length);
    const order = await call("POST", "/api/orders", { items: [{ id: plain.id, quantity: 2 }], customer: { name: "Persist Me", email: "persist@test.local", phone: "9800000000" }, shipping: { address: "Some Street 12", city: "Kathmandu" } }, user.token);
    assert.equal(order.status, 200);
    await call("PUT", "/api/admin/settings", { phone: "+977 9800011111" }, admin);
    await call("DELETE", `/api/admin/coupons/NOPE`, null, admin);

    // upload a tiny valid PNG
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const up = await call("POST", "/api/upload", { data: "data:image/png;base64," + png.toString("base64") }, admin);
    assert.equal(up.status, 200);
    const url = up.url;

    await new Promise((r) => setTimeout(r, 400)); // let the debounced save run
    await stop(child);

    // ---- restart with the same "database" ----
    child = start();
    await ready();
    const admin2 = (await call("POST", "/api/auth/login", { email: "admin@test.local", password: "AdminPass123" })).token;
    assert.ok(admin2, "admin still exists (not re-created)");
    const login = await call("POST", "/api/auth/login", { email: "persist@test.local", password: "password123" });
    assert.equal(login.status, 200, "customer survived restart");
    const orders = (await call("GET", "/api/account/orders", null, login.token)).orders;
    assert.equal(orders.length, 1);
    assert.equal(orders[0].id, order.order.id);
    assert.equal((await call("GET", "/api/products")).products.length, 12, "demo products not duplicated");
    assert.equal((await call("GET", "/api/settings")).settings.phone, "+977 9800011111");
    const stock = (await call("GET", "/api/products/" + plain.id)).product.stock;
    assert.equal(stock, plain.stock - 2, "stock deduction survived");

    const img = await fetch(BASE + url);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await img.arrayBuffer()), png);

    await stop(child);
    fs.rmSync(dir, { recursive: true, force: true });
});
