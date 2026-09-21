/* End-to-end API tests. Run with:  npm test
   Starts the server on a temporary port with a temporary database. */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopease-test-"));
let child;

async function call(method, url, body, token) {
    const res = await fetch(BASE + url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { status: res.status, ...data };
}

before(async () => {
    child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        env: { ...process.env, PORT, DATA_DIR: dataDir, ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "AdminPass123", JWT_SECRET: "test-secret-test-secret" },
        stdio: "ignore"
    });
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(BASE + "/api/health")).ok) return; } catch (e) { /* wait */ }
        await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("server did not start");
});

after(() => { child && child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const state = {};

test("catalogue is seeded and public", async () => {
    const r = await call("GET", "/api/products");
    assert.equal(r.success, true);
    assert.equal(r.products.length, 12);
    assert.ok(r.products[0].image);
    state.product = r.products.find((p) => p.sizes.length === 0);
    state.sized = r.products.find((p) => p.sizes.length > 0);
});

test("auth: register, duplicate, login, wrong password", async () => {
    let r = await call("POST", "/api/auth/register", { name: "Asha Rai", email: "asha@test.local", password: "password123", phone: "9800000000" });
    assert.equal(r.status, 200);
    state.customer = r.token;
    r = await call("POST", "/api/auth/register", { name: "Asha Rai", email: "asha@test.local", password: "password123" });
    assert.equal(r.status, 409);
    r = await call("POST", "/api/auth/login", { email: "asha@test.local", password: "wrong-password" });
    assert.equal(r.status, 401);
    r = await call("POST", "/api/auth/login", { email: "admin@test.local", password: "AdminPass123" });
    assert.equal(r.user.role, "admin");
    state.admin = r.token;
});

test("roles are enforced", async () => {
    assert.equal((await call("GET", "/api/admin/stats")).status, 401);
    assert.equal((await call("GET", "/api/admin/stats", null, state.customer)).status, 403);
    assert.equal((await call("GET", "/api/seller/stats", null, state.customer)).status, 403);
    assert.equal((await call("GET", "/api/admin/stats", null, state.admin)).status, 200);
});

test("seller registers, waits for approval, then can add a product", async () => {
    let r = await call("POST", "/api/auth/register", { name: "Sita Shrestha", email: "sita@test.local", password: "password123", phone: "9811111111", role: "seller", shopName: "Sita Crafts" });
    assert.equal(r.user.status, "pending");
    state.seller = r.token;
    state.sellerId = r.user.id;

    const form = { name: "Handmade Wool Scarf", category: "accessories", price: 900, stock: 10, description: "Warm handmade wool scarf.", images: ["https://example.com/a.jpg"], sizes: "" };
    r = await call("POST", "/api/seller/products", form, state.seller);
    assert.equal(r.status, 403); // not approved yet

    r = await call("PUT", `/api/admin/users/${state.sellerId}`, { status: "active" }, state.admin);
    assert.equal(r.user.status, "active");

    r = await call("POST", "/api/seller/products", form, state.seller);
    assert.equal(r.status, 200);
    state.sellerProduct = r.product;
    assert.equal(r.product.status, "pending");

    // not visible until approved
    let pub = await call("GET", "/api/products");
    assert.ok(!pub.products.some((p) => p.id === state.sellerProduct.id));

    r = await call("PUT", `/api/admin/products/${state.sellerProduct.id}`, { action: "approve" }, state.admin);
    assert.equal(r.product.status, "active");
    pub = await call("GET", "/api/products");
    assert.ok(pub.products.some((p) => p.id === state.sellerProduct.id));
});

test("seller cannot touch another seller's product", async () => {
    const r = await call("PUT", `/api/seller/products/${state.product.id}`, { name: "Hacked product", category: "fashion", price: 1, stock: 1, description: "hacked hacked", images: ["https://x.com/a.jpg"] }, state.seller);
    assert.equal(r.status, 404);
});

test("order: server recalculates prices, checks size and stock", async () => {
    const good = {
        items: [{ id: state.product.id, quantity: 2 }, { id: state.sellerProduct.id, quantity: 1 }],
        customer: { name: "Asha Rai", email: "asha@test.local", phone: "9800000000" },
        shipping: { address: "Baneshwor, Ward 10", city: "Kathmandu", postalCode: "44600" },
        paymentMethod: "cod",
        price: 1 // ignored
    };
    // missing size on a sized product
    let r = await call("POST", "/api/orders", { ...good, items: [{ id: state.sized.id, quantity: 1 }] }, state.customer);
    assert.equal(r.status, 400);
    // too many
    r = await call("POST", "/api/orders", { ...good, items: [{ id: state.product.id, quantity: 20 }, { id: state.product.id, quantity: 20 }] });
    assert.equal(r.status, 400);

    r = await call("POST", "/api/orders", good, state.customer);
    assert.equal(r.status, 200);
    const expectedSubtotal = state.product.price * 2 + 900;
    assert.equal(r.order.subtotal, expectedSubtotal);
    assert.equal(r.order.shippingFee, expectedSubtotal >= 3000 ? 0 : 100);
    assert.equal(r.order.total, r.order.subtotal + r.order.shippingFee);
    state.order = r.order;

    const after = await call("GET", "/api/products");
    assert.equal(after.products.find((p) => p.id === state.product.id).stock, state.product.stock - 2);
});

test("coupons: create, apply, reject below minimum", async () => {
    let r = await call("POST", "/api/admin/coupons", { code: "WELCOME10", type: "percent", value: 10, minOrder: 1000 }, state.admin);
    assert.equal(r.status, 200);
    r = await call("POST", "/api/coupons/validate", { code: "welcome10", subtotal: 500 });
    assert.equal(r.status, 400);
    r = await call("POST", "/api/coupons/validate", { code: "welcome10", subtotal: 2000 });
    assert.equal(r.discount, 200);
});

test("guest can track an order with email or phone", async () => {
    let r = await call("POST", "/api/orders/track", { orderId: state.order.id, contact: "asha@test.local" });
    assert.equal(r.status, 200);
    r = await call("POST", "/api/orders/track", { orderId: state.order.id, contact: "9800000000" });
    assert.equal(r.status, 200);
    r = await call("POST", "/api/orders/track", { orderId: state.order.id, contact: "someone@else.com" });
    assert.equal(r.status, 404);
});

test("seller only sees their own items and can ship them", async () => {
    let r = await call("GET", "/api/seller/orders", null, state.seller);
    assert.equal(r.orders.length, 1);
    assert.equal(r.orders[0].items.length, 1);
    assert.equal(r.orders[0].items[0].sellerId, state.sellerId);

    r = await call("PUT", `/api/seller/orders/${state.order.id}/status`, { status: "confirmed" }, state.seller);
    assert.equal(r.status, 200);
    r = await call("PUT", `/api/seller/orders/${state.order.id}/status`, { status: "shipped" }, state.seller);
    assert.equal(r.status, 200);

    // whole order is mixed now, admin sees "processing"
    r = await call("GET", "/api/admin/orders", null, state.admin);
    assert.equal(r.orders[0].status, "processing");
});

test("customer can't cancel once confirmed; admin delivers and COD becomes paid", async () => {
    let r = await call("POST", `/api/account/orders/${state.order.id}/cancel`, {}, state.customer);
    assert.equal(r.status, 400);

    r = await call("PUT", `/api/admin/orders/${state.order.id}`, { status: "delivered" }, state.admin);
    assert.equal(r.order.status, "delivered");
    assert.equal(r.order.paymentStatus, "paid");
});

test("cancel restores stock", async () => {
    const before = (await call("GET", "/api/products")).products.find((p) => p.id === state.product.id).stock;
    let r = await call("POST", "/api/orders", {
        items: [{ id: state.product.id, quantity: 3 }],
        customer: { name: "Asha Rai", email: "asha@test.local", phone: "9800000000" },
        shipping: { address: "Baneshwor, Ward 10", city: "Kathmandu" },
        paymentMethod: "online", paymentRef: "ESW12345"
    }, state.customer);
    assert.equal(r.status, 200);
    const id = r.order.id;
    assert.equal(r.order.paymentStatus, "pending");
    r = await call("POST", `/api/account/orders/${id}/cancel`, {}, state.customer);
    assert.equal(r.order.status, "cancelled");
    const after = (await call("GET", "/api/products")).products.find((p) => p.id === state.product.id).stock;
    assert.equal(after, before);
});

test("reviews: verified badge and rating aggregate", async () => {
    let r = await call("POST", `/api/products/${state.product.id}/reviews`, { rating: 5, comment: "Great quality" }, state.customer);
    assert.equal(r.status, 200);
    r = await call("GET", `/api/products/${state.product.id}/reviews`);
    assert.equal(r.reviews.length, 1);
    assert.equal(r.reviews[0].verified, true);
    r = await call("GET", `/api/products/${state.product.id}`);
    assert.equal(r.product.rating, 5);
    assert.equal(r.product.reviews, 1);
});

test("wishlist syncs for logged in users", async () => {
    let r = await call("PUT", "/api/account/wishlist", { wishlist: [1, 2, 2, 3] }, state.customer);
    assert.deepEqual(r.wishlist, [1, 2, 3]);
});

test("contact form reaches admin", async () => {
    let r = await call("POST", "/api/contact", { name: "Ram", email: "ram@test.local", message: "Do you deliver outside the valley?" });
    assert.equal(r.status, 200);
    r = await call("GET", "/api/admin/messages", null, state.admin);
    assert.equal(r.messages.length, 1);
});

test("admin stats and settings", async () => {
    let r = await call("GET", "/api/admin/stats", null, state.admin);
    assert.ok(r.stats.orders >= 2);
    assert.equal(r.chart.length, 14);
    r = await call("PUT", "/api/admin/settings", { shippingFee: 150, phone: "+977 9800000000" }, state.admin);
    assert.equal(r.settings.shippingFee, 150);
    r = await call("GET", "/api/settings");
    assert.equal(r.settings.shippingFee, 150);
    assert.equal(r.settings.commissionPercent, undefined); // private
});

test("blocked users are locked out", async () => {
    const users = await call("GET", "/api/admin/users", null, state.admin);
    const asha = users.users.find((u) => u.email === "asha@test.local");
    await call("PUT", `/api/admin/users/${asha.id}`, { status: "blocked" }, state.admin);
    assert.equal((await call("GET", "/api/account", null, state.customer)).status, 401);
    assert.equal((await call("POST", "/api/auth/login", { email: "asha@test.local", password: "password123" })).status, 403);
});
