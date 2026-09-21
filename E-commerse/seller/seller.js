/* Seller dashboard */
(function () {
    const { $, $$, esc, money, icon, toast, modal, api, Auth, imgSrc, fmtDate, fmtDateTime, statusPill, Settings, writeJSON } = SE;

    const isApproved = () => P.user.status === "active";
    const pendingBanner = () =>
        P.user.status === "pending"
            ? `<div class="pending-banner">${icon("clock")}<div><strong>Your seller account is waiting for approval.</strong><br>Our team will review it soon. You can complete your shop profile now, and you'll be able to add products as soon as you're approved.</div></div>`
            : P.user.status === "blocked" ? '<div class="pending-banner" style="background:var(--danger-50);color:#912018">Your seller account is suspended. Please contact support.</div>' : "";

    let categories = null;
    async function loadCategories() {
        if (!categories) categories = (await api("/api/settings", { auth: false })).settings.categories;
        return categories;
    }

    /* ---------------- dashboard ---------------- */
    async function dashboard(host) {
        const d = await api("/api/seller/stats");
        const s = d.stats;
        host.innerHTML = `${P.head("Dashboard", `Welcome back, ${P.user.name.split(" ")[0]}.`)}
            ${pendingBanner()}
            <div class="strip">
                <div><span>Sales</span><b>${money(s.grossSales)}</b><small>${s.orders} orders (excl. cancelled)</small></div>
                <div><span>Your earnings</span><b>${money(s.earnings)}</b><small>Delivered orders after ${d.commissionPercent}% commission</small></div>
                <div><span>To fulfil</span><b>${s.toFulfil}</b><small>Orders waiting on you</small></div>
                <div><span>Live products</span><b>${s.activeProducts}</b><small>${s.pendingApproval} awaiting approval</small></div>
            </div>
            <div class="grid-2">
                <div class="box"><div class="box-head"><h3>Sales, last 14 days</h3></div>${P.chart(d.chart)}</div>
                <div class="box"><div class="box-head"><h3>Low stock</h3></div>
                    ${d.lowStock.length ? `<div class="mini-list">${d.lowStock.map((p) => `<div><span class="left"><strong>${esc(p.name)}</strong></span><span class="pill ${p.stock === 0 ? "pill-danger" : "pill-warn"}">${p.stock === 0 ? "Sold out" : p.stock + " left"}</span></div>`).join("")}</div>` : '<p class="muted">All your products have healthy stock.</p>'}
                </div>
            </div>
            <div class="box"><div class="box-head"><h3>Recent orders</h3><a class="link" href="#/orders">View all</a></div>${P.ordersTable(d.recent)}</div>`;
        P.setBadge("orders", s.toFulfil);
    }

    /* ---------------- products ---------------- */
    let products = [], pFilter = "all", pQuery = "";
    async function productsView(host) {
        products = (await api("/api/seller/products")).products;
        await loadCategories();
        drawProducts(host);
    }

    function drawProducts(host) {
        const tabs = [["all", "All"], ["live", "Live"], ["pending", "Awaiting approval"], ["draft", "Draft"], ["rejected", "Rejected"]];
        const match = (p) => pFilter === "all" ? p.status !== "archived" : pFilter === "live" ? p.status === "active" && p.approved : p.status === pFilter;
        const list = products.filter((p) => match(p) && p.name.toLowerCase().includes(pQuery.toLowerCase()));
        host.innerHTML = `${P.head("Products", "Manage what you sell.", `<button class="btn btn-primary" id="add-product" ${isApproved() ? "" : "disabled"}>${icon("plus", "icon icon-sm")}Add product</button>`)}
            ${pendingBanner()}
            <div class="toolbar"><input class="input search" id="p-search" placeholder="Search your products" value="${esc(pQuery)}"><div class="tabs">${tabs.map(([k, l]) => `<button type="button" data-f="${k}" class="${pFilter === k ? "is-active" : ""}">${l}</button>`).join("")}</div></div>
            ${P.table(["Product", "Price", "Stock", "Sold", "Status", ""].map((h) => (h ? { label: h, num: h === "" } : "")), list.map((p) => `<tr>
                <td><div class="cell-prod"><img class="thumb" src="${esc(imgSrc(p.image))}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.categoryName)}</small></div></div></td>
                <td>${money(p.price)}</td>
                <td>${p.stock <= 0 ? '<span class="pill pill-danger">Sold out</span>' : p.stock}</td>
                <td>${p.sold}</td>
                <td>${P.productStatusPill(p)}${p.status === "rejected" && p.rejectReason ? `<br><small class="muted">${esc(p.rejectReason)}</small>` : ""}</td>
                <td><div class="row-actions"><button class="ia" data-edit="${p.id}" ${isApproved() ? "" : "disabled"}>${icon("edit", "icon icon-sm")}Edit</button><button class="ia danger" data-del="${p.id}" ${isApproved() ? "" : "disabled"} aria-label="Delete">${icon("trash", "icon icon-sm")}</button></div></td></tr>`), "No products here yet.")}`;

        $("#p-search").addEventListener("input", SE.debounce((e) => { pQuery = e.target.value; drawProducts(host); $("#p-search").focus(); $("#p-search").setSelectionRange(pQuery.length, pQuery.length); }, 250));
        $$("[data-f]", host).forEach((b) => b.addEventListener("click", () => { pFilter = b.dataset.f; drawProducts(host); }));
        const open = (product) => P.productForm({ product, base: "/api/seller/products", categories, onSaved: () => P.reload() });
        $("#add-product") && $("#add-product").addEventListener("click", () => open(null));
        $$("[data-edit]", host).forEach((b) => b.addEventListener("click", () => open(products.find((p) => p.id === Number(b.dataset.edit)))));
        $$("[data-del]", host).forEach((b) => b.addEventListener("click", async () => {
            const p = products.find((x) => x.id === Number(b.dataset.del));
            if (!confirm(`Delete "${p.name}"?`)) return;
            try { const r = await api(`/api/seller/products/${p.id}`, { method: "DELETE" }); toast(r.message); P.reload(); }
            catch (e) { toast(e.message, "error"); }
        }));
    }

    /* ---------------- orders ---------------- */
    let orders = [], oFilter = "all";
    async function ordersView(host) {
        orders = (await api("/api/seller/orders")).orders;
        drawOrders(host);
    }

    function nextActions(status) {
        return { pending: [["confirmed", "Confirm"], ["cancelled", "Cancel"]], confirmed: [["shipped", "Mark shipped"], ["cancelled", "Cancel"]], shipped: [["delivered", "Mark delivered"]], processing: [["shipped", "Mark shipped"], ["delivered", "Mark delivered"]] }[status] || [];
    }

    function drawOrders(host) {
        const tabs = [["all", "All"], ["pending", "New"], ["confirmed", "Confirmed"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
        const list = orders.filter((o) => oFilter === "all" || o.status === oFilter);
        host.innerHTML = `${P.head("Orders", "Orders that include your products.")}${pendingBanner()}
            <div class="toolbar"><div class="tabs">${tabs.map(([k, l]) => `<button type="button" data-f="${k}" class="${oFilter === k ? "is-active" : ""}">${l}</button>`).join("")}</div></div>
            ${P.table(["Order", "Date", "Customer", "Items", "Your total", "Status", ""].map((h) => (h ? { label: h } : "")), list.map((o) => `<tr>
                <td><b style="color:var(--ink)">${esc(o.id)}</b></td><td>${fmtDate(o.createdAt)}</td>
                <td>${esc(o.customer.name)}<br><small class="muted">${esc(o.shipping.city)}</small></td>
                <td>${o.items.map((i) => `${esc(i.name)} ×${i.quantity}`).join("<br>")}</td>
                <td>${money(o.total)}</td><td>${statusPill(o.status)}</td>
                <td><div class="row-actions"><button class="ia" data-open="${esc(o.id)}">${icon("eye", "icon icon-sm")}Open</button></div></td></tr>`), "No orders yet. They'll show up here when customers buy your products.")}`;
        $$("[data-f]", host).forEach((b) => b.addEventListener("click", () => { oFilter = b.dataset.f; drawOrders(host); }));
        $$("[data-open]", host).forEach((b) => b.addEventListener("click", () => orderModal(b.dataset.open)));
    }

    function orderModal(id) {
        const o = orders.find((x) => x.id === id);
        const acts = isApproved() ? nextActions(o.status) : [];
        const body = document.createElement("div");
        body.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px"><div><b style="color:var(--ink);font-size:18px">${esc(o.id)}</b><br><span class="muted">${fmtDateTime(o.createdAt)}</span></div>${statusPill(o.status)}</div>
            ${o.items.map((i) => `<div class="order-item"><img src="${esc(imgSrc(i.image))}" alt=""><div><strong style="color:var(--ink)">${esc(i.name)}</strong><br><span class="muted" style="font-size:13px">${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.quantity} · ${esc((SE.STATUS[i.status] || [i.status])[0])}</span></div><b>${money(i.price * i.quantity)}</b></div>`).join("")}
            <div class="divider" style="margin:14px 0"></div>
            <div class="kv-list">
                <div><span>Your total</span><b>${money(o.total)}</b></div>
                <div><span>Payment</span><b>${o.paymentMethod === "cod" ? "Cash on delivery: collect " + money(o.total) + " + delivery (if any)" : "Online payment"}</b></div>
                <div><span>Ship to</span><b>${esc(o.customer.name)}<br>${esc(o.shipping.address)}, ${esc(o.shipping.city)}${o.shipping.postalCode ? " " + esc(o.shipping.postalCode) : ""}</b></div>
                <div><span>Phone</span><b><a class="link" href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></b></div>
                ${o.notes ? `<div><span>Customer note</span><b>${esc(o.notes)}</b></div>` : ""}
            </div>`;
        const foot = document.createElement("div");
        foot.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;width:100%";
        foot.innerHTML = '<button class="btn btn-outline" data-print>Print packing slip</button>' + acts.map(([s, l]) => `<button class="btn ${s === "cancelled" ? "btn-outline" : "btn-primary"}" data-status="${s}" ${s === "cancelled" ? 'style="color:var(--danger)"' : ""}>${l}</button>`).join("");
        const m = modal({ title: "Order details", body, footer: foot });
        m.el.querySelector(".modal-foot").style.justifyContent = "flex-end";
        foot.querySelector("[data-print]").addEventListener("click", P.printModal);
        $$("[data-status]", foot).forEach((b) => b.addEventListener("click", async () => {
            if (b.dataset.status === "cancelled" && !confirm("Cancel your items in this order? Stock will be returned.")) return;
            b.disabled = true;
            try {
                await api(`/api/seller/orders/${o.id}/status`, { method: "PUT", body: { status: b.dataset.status } });
                m.close(); toast("Order updated"); P.reload();
            } catch (e) { toast(e.message, "error"); b.disabled = false; }
        }));
    }

    /* ---------------- shop profile ---------------- */
    async function profileView(host) {
        const u = P.user, shop = u.shop || {};
        host.innerHTML = `${P.head("Shop profile", "Your details as seen by the store team.")}${pendingBanner()}
            <form class="box" id="shop-form" style="max-width:720px"><div class="form-grid">
                <div class="field"><label>Shop name</label><input class="input" name="shopName" value="${esc(shop.name || "")}" maxlength="80" required></div>
                <div class="field"><label>Your name</label><input class="input" name="name" value="${esc(u.name)}" maxlength="80" required></div>
                <div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(u.phone || "")}" maxlength="18"></div>
                <div class="field"><label>Email</label><input class="input" value="${esc(u.email)}" disabled></div>
                <div class="field full"><label>Shop address</label><input class="input" name="shopAddress" value="${esc(shop.address || "")}" maxlength="200"></div>
                <div class="field full"><label>About your shop</label><textarea class="textarea" name="shopDescription" maxlength="300">${esc(shop.description || "")}</textarea></div>
                <div class="full field-error" id="sp-err"></div>
                <div class="full"><button class="btn btn-primary" type="submit">Save profile</button></div></div></form>`;
        $("#shop-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            try {
                const r = await api("/api/seller/profile", { method: "PUT", body: Object.fromEntries(f) });
                writeJSON("se_user", r.user); P.user = r.user;
                toast("Profile saved");
            } catch (err) { $("#sp-err").textContent = err.message; }
        });
    }

    P.mount({
        role: "seller",
        title: "Seller",
        home: "dashboard",
        nav: [
            { key: "dashboard", label: "Dashboard", icon: "grid" },
            { key: "products", label: "Products", icon: "package" },
            { key: "orders", label: "Orders", icon: "receipt" },
            { key: "profile", label: "Shop profile", icon: "store" }
        ],
        views: { dashboard, products: productsView, orders: ordersView, profile: profileView }
    });
})();
