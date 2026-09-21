/* Customer account: overview, orders, addresses, profile, security */
(function () {
    const { $, $$, esc, money, App, Auth, Catalog, Wishlist, api, toast, modal, icon, imgSrc, link, fmtDate, fmtDateTime, statusPill, paymentPill } = SE;

    const state = { orders: null, addresses: [], user: null };
    const VIEWS = ["overview", "orders", "addresses", "profile", "security"];
    const STEPS = [["pending", "Placed"], ["confirmed", "Confirmed"], ["shipped", "Shipped"], ["delivered", "Delivered"]];

    const view = () => (VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview");
    const main = () => $("#acc-main");

    function progress(status) {
        if (status === "cancelled") return "";
        const idx = status === "processing" ? 1 : Math.max(0, STEPS.findIndex((s) => s[0] === status));
        return `<div class="steps">${STEPS.map((s, i) => `<div class="${i <= idx ? "done" : ""}">${s[1]}</div>`).join("")}</div>`;
    }

    function nav() {
        const u = state.user;
        const items = [["overview", "grid", "Overview"], ["orders", "package", "My orders"], ["addresses", "pin", "Addresses"], ["profile", "user", "Profile"], ["security", "lock", "Password"]];
        $("#acc-nav").innerHTML =
            `<div class="who"><span class="avatar">${esc(u.name.charAt(0).toUpperCase())}</span><div><strong style="color:var(--ink);display:block">${esc(u.name)}</strong><small class="muted">${esc(u.email)}</small></div></div>` +
            items.map(([k, i, l]) => `<button type="button" data-view="${k}" class="${view() === k ? "is-active" : ""}">${icon(i)}${l}</button>`).join("") +
            `<a href="${link("wishlist.html")}">${icon("heart")}Wishlist</a>` +
            (u.role === "seller" ? `<a href="${link("seller/index.html")}">${icon("store")}Seller dashboard</a>` : "") +
            (u.role === "admin" ? `<a href="${link("admin/index.html")}">${icon("grid")}Admin dashboard</a>` : "") +
            `<button type="button" id="acc-logout">${icon("logout")}Sign out</button>`;
    }

    function orderCard(o) {
        const canCancel = o.items.some((i) => i.status !== "cancelled") && o.items.every((i) => ["pending", "cancelled"].includes(i.status));
        return `<div class="order-card">
            <div class="order-head">
                <div><b>${esc(o.id)}</b><br><span class="muted" style="font-size:13px">${fmtDate(o.createdAt)}</span></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">${statusPill(o.status)}${paymentPill(o.paymentStatus)}</div>
            </div>
            <div class="order-body">
                ${progress(o.status)}
                ${o.items.map((i) => `<div class="order-item"><img src="${esc(imgSrc(i.image))}" alt=""><div><a href="${link("product.html")}?id=${i.productId}" style="font-weight:600;color:var(--ink)">${esc(i.name)}</a><br><span class="muted" style="font-size:13px">${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.quantity}</span></div><b>${money(i.price * i.quantity)}</b></div>`).join("")}
            </div>
            <div class="order-foot">
                <span>Total <b style="color:var(--ink)">${money(o.total)}</b></span>
                <span style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-outline btn-sm" data-detail="${esc(o.id)}" type="button">Details</button>
                    ${canCancel ? `<button class="btn btn-outline btn-sm" data-cancel="${esc(o.id)}" type="button" style="color:var(--danger)">Cancel order</button>` : ""}
                </span>
            </div>
        </div>`;
    }

    function showDetail(id) {
        const o = state.orders.find((x) => x.id === id);
        if (!o) return;
        const body = `
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px"><div><b style="color:var(--ink);font-size:18px">${esc(o.id)}</b><br><span class="muted">${fmtDateTime(o.createdAt)}</span></div><div style="display:flex;gap:8px;align-items:start">${statusPill(o.status)}${paymentPill(o.paymentStatus)}</div></div>
            ${o.items.map((i) => `<div class="order-item"><img src="${esc(imgSrc(i.image))}" alt=""><div><strong style="color:var(--ink)">${esc(i.name)}</strong><br><span class="muted" style="font-size:13px">${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.quantity} · ${esc((SE.STATUS[i.status] || [i.status])[0])}</span></div><b>${money(i.price * i.quantity)}</b></div>`).join("")}
            <div class="divider" style="margin:14px 0"></div>
            <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
            ${o.discount ? `<div class="sum-row"><span>Discount ${esc(o.couponCode)}</span><span class="discount">− ${money(o.discount)}</span></div>` : ""}
            <div class="sum-row"><span>Delivery</span><span>${o.shippingFee ? money(o.shippingFee) : "Free"}</span></div>
            <div class="sum-row total" style="margin-top:8px"><span>Total</span><span>${money(o.total)}</span></div>
            <div class="divider" style="margin:16px 0"></div>
            <p><b style="color:var(--ink)">Delivery address</b><br>${esc(o.customer.name)}, ${esc(o.customer.phone)}<br>${esc(o.shipping.address)}, ${esc(o.shipping.city)}</p>
            <p style="margin-top:10px"><b style="color:var(--ink)">Payment</b><br>${o.paymentMethod === "cod" ? "Cash on delivery" : "Online payment" + (o.paymentRef ? " · Ref " + esc(o.paymentRef) : "")}</p>
            <h4 style="margin:20px 0 8px">History</h4>
            <div class="timeline">${o.timeline.slice().reverse().map((t) => `<div class="tl-step ${t.status === "cancelled" ? "is-cancelled" : ""}"><i></i><strong>${esc((SE.STATUS[t.status] || [t.status])[0])}</strong><small>${fmtDateTime(t.at)}${t.note ? " · " + esc(t.note) : ""}</small></div>`).join("")}</div>`;
        modal({
            title: "Order details",
            body,
            footer: '<button class="btn btn-outline" id="print-order" type="button">Print invoice</button>'
        });
        $("#print-order").addEventListener("click", () => {
            document.body.classList.add("printing-modal");
            window.print();
            setTimeout(() => document.body.classList.remove("printing-modal"), 500);
        });
    }

    async function loadOrders() {
        if (state.orders) return;
        try { state.orders = (await api("/api/account/orders")).orders; }
        catch (e) { state.orders = []; toast(e.message, "error"); }
    }

    /* ---------- views ---------- */
    async function renderOverview() {
        await loadOrders();
        const active = state.orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
        main().innerHTML = `<h1 style="font-size:28px;margin-bottom:22px">Hello, ${esc(state.user.name.split(" ")[0])}</h1>
            <div class="stat-row">
                <div class="stat"><b>${state.orders.length}</b><span>Total orders</span></div>
                <div class="stat"><b>${active}</b><span>In progress</span></div>
                <div class="stat"><b>${Wishlist.ids().length}</b><span>Saved items</span></div>
            </div>
            ${state.user.role === "seller" && state.user.status === "pending" ? '<div class="alert alert-info" style="margin-bottom:22px">Your seller account is waiting for approval from the store team.</div>' : ""}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h2 style="font-size:20px">Recent orders</h2>${state.orders.length ? '<button class="link" data-view="orders" type="button">View all</button>' : ""}</div>
            ${state.orders.length ? state.orders.slice(0, 2).map(orderCard).join("") : `<div class="empty">${icon("package")}<h3>No orders yet</h3><p>When you place an order it will show up here.</p><a class="btn btn-primary" href="${link("products.html")}">Start shopping</a></div>`}`;
    }

    async function renderOrders() {
        await loadOrders();
        main().innerHTML = `<h1 style="font-size:28px;margin-bottom:22px">My orders</h1>` +
            (state.orders.length ? state.orders.map(orderCard).join("") : `<div class="empty">${icon("package")}<h3>No orders yet</h3><p>When you place an order it will show up here.</p><a class="btn btn-primary" href="${link("products.html")}">Start shopping</a></div>`);
    }

    async function renderAddresses() {
        try { state.addresses = (await api("/api/account")).addresses; } catch (e) { /* keep */ }
        main().innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;gap:12px;flex-wrap:wrap"><h1 style="font-size:28px">Addresses</h1><button class="btn btn-dark" id="add-addr" type="button">${icon("plus", "icon icon-sm")}Add address</button></div>` +
            (state.addresses.length
                ? state.addresses.map((a) => `<div class="addr"><div><strong style="color:var(--ink)">${esc(a.label)}</strong><br>${esc(a.name)}${a.phone ? ", " + esc(a.phone) : ""}<br>${esc(a.address)}, ${esc(a.city)}${a.postalCode ? " " + esc(a.postalCode) : ""}</div><button class="remove-btn" data-del-addr="${esc(a.id)}" type="button">Delete</button></div>`).join("")
                : `<div class="empty">${icon("pin")}<h3>No saved addresses</h3><p>Save an address to fill in checkout faster.</p></div>`);
    }

    function addressModal() {
        const m = modal({
            title: "Add address",
            body: `<form id="addr-form" class="form-grid">
                <div class="field"><label>Label</label><input class="input" id="a-label" placeholder="Home, Office…" maxlength="30"></div>
                <div class="field"><label>Full name</label><input class="input" id="a-name" value="${esc(state.user.name)}" maxlength="80"></div>
                <div class="field"><label>Phone</label><input class="input" id="a-phone" value="${esc(state.user.phone || "")}" maxlength="18"></div>
                <div class="field"><label>City</label><input class="input" id="a-city" maxlength="60" required></div>
                <div class="field full"><label>Street address</label><input class="input" id="a-address" maxlength="200" placeholder="Area, street, house no." required></div>
                <div class="field"><label>Postal code (optional)</label><input class="input" id="a-postal" maxlength="12"></div>
                <div class="full field-error" id="a-err"></div>
                <div class="full"><button class="btn btn-primary" type="submit">Save address</button></div></form>`
        });
        $("#addr-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const r = await api("/api/account/addresses", { method: "POST", body: { label: $("#a-label").value, name: $("#a-name").value, phone: $("#a-phone").value, city: $("#a-city").value, address: $("#a-address").value, postalCode: $("#a-postal").value } });
                state.addresses = r.addresses;
                m.close();
                renderAddresses();
            } catch (err) { $("#a-err").textContent = err.message; }
        });
    }

    function renderProfile() {
        const u = state.user;
        main().innerHTML = `<h1 style="font-size:28px;margin-bottom:22px">Profile</h1>
            <form class="card form-grid" id="profile-form" style="max-width:640px">
                <div class="field"><label>Full name</label><input class="input" id="p-name" value="${esc(u.name)}" maxlength="80" required></div>
                <div class="field"><label>Phone</label><input class="input" id="p-phone" value="${esc(u.phone || "")}" maxlength="18"></div>
                <div class="field full"><label>Email</label><input class="input" value="${esc(u.email)}" disabled><small>Your email can't be changed here. Contact support if you need to update it.</small></div>
                <div class="full field-error" id="p-err"></div>
                <div class="full"><button class="btn btn-primary" type="submit">Save changes</button></div>
            </form>`;
    }

    function renderSecurity() {
        main().innerHTML = `<h1 style="font-size:28px;margin-bottom:22px">Change password</h1>
            <form class="card" id="pw-form" style="max-width:480px;display:grid;gap:16px">
                <div class="field"><label>Current password</label><input class="input" id="pw-cur" type="password" autocomplete="current-password" required></div>
                <div class="field"><label>New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="8" required><small>At least 8 characters.</small></div>
                <div class="field-error" id="pw-err"></div>
                <button class="btn btn-primary" type="submit" style="justify-self:start">Update password</button>
            </form>`;
    }

    async function render() {
        nav();
        const v = view();
        main().innerHTML = '<div class="skeleton" style="height:200px"></div>';
        if (v === "overview") await renderOverview();
        else if (v === "orders") await renderOrders();
        else if (v === "addresses") await renderAddresses();
        else if (v === "profile") renderProfile();
        else renderSecurity();
    }

    App.start(async () => {
        if (!App.requireLogin()) return;
        state.user = Auth.user();
        const fresh = await Auth.refresh();
        if (!Auth.isLoggedIn()) return App.requireLogin();
        if (fresh) state.user = fresh;

        window.addEventListener("hashchange", render);
        render();

        document.addEventListener("click", async (e) => {
            const t = e.target;
            const v = t.closest("[data-view]");
            if (v) { e.preventDefault(); location.hash = v.dataset.view; if (view() === v.dataset.view) render(); return; }
            if (t.closest("#acc-logout")) return Auth.logout();
            const d = t.closest("[data-detail]");
            if (d) return showDetail(d.dataset.detail);
            const c = t.closest("[data-cancel]");
            if (c) {
                if (!confirm("Cancel this order?")) return;
                try {
                    const r = await api(`/api/account/orders/${c.dataset.cancel}/cancel`, { method: "POST", body: {} });
                    state.orders = state.orders.map((o) => (o.id === r.order.id ? r.order : o));
                    toast("Order cancelled");
                    Catalog.load();
                    render();
                } catch (err) { toast(err.message, "error"); }
                return;
            }
            if (t.closest("#add-addr")) return addressModal();
            const da = t.closest("[data-del-addr]");
            if (da) {
                try { state.addresses = (await api(`/api/account/addresses/${da.dataset.delAddr}`, { method: "DELETE" })).addresses; renderAddresses(); }
                catch (err) { toast(err.message, "error"); }
            }
        });

        document.addEventListener("submit", async (e) => {
            if (e.target.id === "profile-form") {
                e.preventDefault();
                try {
                    const r = await api("/api/account/profile", { method: "PUT", body: { name: $("#p-name").value, phone: $("#p-phone").value } });
                    state.user = r.user;
                    SE.writeJSON("se_user", r.user);
                    toast("Profile updated");
                    nav();
                } catch (err) { $("#p-err").textContent = err.message; }
            }
            if (e.target.id === "pw-form") {
                e.preventDefault();
                try {
                    await api("/api/auth/password", { method: "PUT", body: { current: $("#pw-cur").value, next: $("#pw-new").value } });
                    toast("Password updated");
                    e.target.reset();
                    $("#pw-err").textContent = "";
                } catch (err) { $("#pw-err").textContent = err.message; }
            }
        });
    });
})();
