/* Admin dashboard */
(function () {
    const { $, $$, esc, money, icon, toast, modal, api, imgSrc, fmtDate, fmtDateTime, statusPill, paymentPill, writeJSON } = SE;

    let settings = null;
    async function loadSettings(force) {
        if (!settings || force) settings = (await api("/api/admin/settings")).settings;
        return settings;
    }

    function confirmAsk(text) { return window.confirm(text); }

    /* ================= DASHBOARD ================= */
    async function dashboard(host) {
        const d = await api("/api/admin/stats");
        const s = d.stats;
        const tiles = [
            [s.sellersPending, "seller applications to review", "#/users?role=seller"],
            [s.productsPending, "products awaiting approval", "#/products?f=pending"],
            [s.awaitingPayment, "online payments to confirm", "#/orders?f=payment"],
            [s.unreadMessages, "unread messages", "#/messages"]
        ].filter((t) => t[0] > 0);
        host.innerHTML = `${P.head("Dashboard", "How your store is doing.")}
            ${tiles.length ? `<div class="alerts">${tiles.map(([n, t, h]) => `<a class="alert-tile" href="${h}"><b>${n}</b><span>${t}</span></a>`).join("")}</div>` : ""}
            <div class="strip">
                <div><span>Sales</span><b>${money(s.sales)}</b><small>${money(s.paid)} paid so far</small></div>
                <div><span>Orders</span><b>${s.orders}</b><small>${s.newOrders} new</small></div>
                <div><span>Customers</span><b>${s.customers}</b></div>
                <div><span>Sellers</span><b>${s.sellers}</b><small>${s.sellersPending} pending</small></div>
                <div><span>Live products</span><b>${s.products}</b></div>
            </div>
            <div class="grid-2">
                <div class="box"><div class="box-head"><h3>Sales, last 14 days</h3></div>${P.chart(d.chart)}</div>
                <div class="box"><div class="box-head"><h3>Best sellers</h3></div>
                    ${d.topProducts.length ? `<div class="mini-list">${d.topProducts.map((p) => `<div><span class="left"><img class="thumb" src="${esc(imgSrc(p.image))}" alt=""><strong>${esc(p.name)}</strong></span><span class="muted">${p.units} sold</span></div>`).join("")}</div>` : '<p class="muted">Sales data will appear here after your first orders.</p>'}
                </div>
            </div>
            <div class="grid-2">
                <div class="box"><div class="box-head"><h3>Recent orders</h3><a class="link" href="#/orders">View all</a></div>${P.ordersTable(d.recent)}</div>
                <div class="box"><div class="box-head"><h3>Low stock</h3></div>
                    ${d.lowStock.length ? `<div class="mini-list">${d.lowStock.map((p) => `<div><span class="left"><span><strong>${esc(p.name)}</strong><br><small class="muted">${esc(p.seller)}</small></span></span><span class="pill ${p.stock === 0 ? "pill-danger" : "pill-warn"}">${p.stock === 0 ? "Sold out" : p.stock + " left"}</span></div>`).join("")}</div>` : '<p class="muted">No low-stock products.</p>'}
                </div>
            </div>`;
        P.setBadge("orders", s.newOrders);
        P.setBadge("products", s.productsPending);
        P.setBadge("users", s.sellersPending);
        P.setBadge("messages", s.unreadMessages);
    }

    /* ================= ORDERS ================= */
    let orders = [], oFilter = "all", oQuery = "";
    async function ordersView(host) {
        orders = (await api("/api/admin/orders")).orders;
        const hashF = new URLSearchParams((location.hash.split("?")[1] || "")).get("f");
        if (hashF) oFilter = hashF;
        drawOrders(host);
    }

    function drawOrders(host) {
        const tabs = [["all", "All"], ["pending", "New"], ["confirmed", "Confirmed"], ["processing", "In progress"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"], ["payment", "Payment due"]];
        const match = (o) => oFilter === "all" ? true : oFilter === "payment" ? o.paymentMethod === "online" && o.paymentStatus === "pending" && o.status !== "cancelled" : o.status === oFilter;
        const q = oQuery.toLowerCase();
        const list = orders.filter((o) => match(o) && (!q || (o.id + o.customer.name + o.customer.email + o.customer.phone).toLowerCase().includes(q)));
        host.innerHTML = `${P.head("Orders", `${orders.length} orders in total.`)}
            <div class="toolbar"><input class="input search" id="o-search" placeholder="Search order, name, email or phone" value="${esc(oQuery)}"><div class="tabs">${tabs.map(([k, l]) => `<button type="button" data-f="${k}" class="${oFilter === k ? "is-active" : ""}">${l}</button>`).join("")}</div></div>
            ${P.table(["Order", "Date", "Customer", "Total", "Payment", "Status", ""].map((h) => (h ? { label: h } : "")), list.map((o) => `<tr>
                <td><b style="color:var(--ink)">${esc(o.id)}</b></td><td>${fmtDate(o.createdAt)}</td>
                <td>${esc(o.customer.name)}<br><small class="muted">${esc(o.customer.phone)}</small></td>
                <td>${money(o.total)}</td>
                <td>${o.paymentMethod === "cod" ? "COD" : "Online"} ${paymentPill(o.paymentStatus)}</td>
                <td>${statusPill(o.status)}</td>
                <td><div class="row-actions"><button class="ia" data-open="${esc(o.id)}">${icon("eye", "icon icon-sm")}Open</button></div></td></tr>`), "No orders match.")}`;
        const search = $("#o-search");
        search.addEventListener("input", SE.debounce((e) => { oQuery = e.target.value; drawOrders(host); const s = $("#o-search"); s.focus(); s.setSelectionRange(oQuery.length, oQuery.length); }, 250));
        $$("[data-f]", host).forEach((b) => b.addEventListener("click", () => { oFilter = b.dataset.f; drawOrders(host); }));
        $$("[data-open]", host).forEach((b) => b.addEventListener("click", () => orderModal(b.dataset.open, host)));
    }

    function orderModal(id, host) {
        const o = orders.find((x) => x.id === id);
        const body = document.createElement("div");
        const finalOnly = o.items.every((i) => ["delivered", "cancelled"].includes(i.status));
        body.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px"><div><b style="color:var(--ink);font-size:18px">${esc(o.id)}</b><br><span class="muted">${fmtDateTime(o.createdAt)}</span></div><div style="display:flex;gap:8px;align-items:start">${statusPill(o.status)}${paymentPill(o.paymentStatus)}</div></div>
            ${o.items.map((i) => `<div class="order-item"><img src="${esc(imgSrc(i.image))}" alt=""><div><strong style="color:var(--ink)">${esc(i.name)}</strong><br><span class="muted" style="font-size:13px">${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.quantity} · by ${esc(i.sellerName || "store")} · ${esc((SE.STATUS[i.status] || [i.status])[0])}</span></div><b>${money(i.price * i.quantity)}</b></div>`).join("")}
            <div class="divider" style="margin:14px 0"></div>
            <div class="kv-list">
                <div><span>Subtotal</span><b>${money(o.subtotal)}</b></div>
                ${o.discount ? `<div><span>Coupon ${esc(o.couponCode)}</span><b>− ${money(o.discount)}</b></div>` : ""}
                <div><span>Delivery</span><b>${o.shippingFee ? money(o.shippingFee) : "Free"}</b></div>
                <div><span>Total</span><b style="font-size:16px">${money(o.total)}</b></div>
                <div><span>Payment method</span><b>${o.paymentMethod === "cod" ? "Cash on delivery" : "Online" + (o.paymentRef ? " · Ref " + esc(o.paymentRef) : " · no reference yet")}</b></div>
                <div><span>Customer</span><b>${esc(o.customer.name)}<br>${esc(o.customer.email)}<br>${esc(o.customer.phone)}</b></div>
                <div><span>Ship to</span><b>${esc(o.shipping.address)}, ${esc(o.shipping.city)}${o.shipping.postalCode ? " " + esc(o.shipping.postalCode) : ""}</b></div>
                ${o.notes ? `<div><span>Customer note</span><b>${esc(o.notes)}</b></div>` : ""}
            </div>
            <div class="divider no-print" style="margin:18px 0"></div>
            <div class="no-print" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field"><label>Order status</label><select class="select" id="om-status" ${finalOnly ? "disabled" : ""}>${["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${SE.STATUS[s][0]}</option>`).join("")}${o.status === "processing" ? '<option value="processing" selected disabled>In progress (mixed)</option>' : ""}</select><small>${finalOnly ? "Delivered or cancelled orders can't change." : "Applies to every item that isn't already delivered or cancelled."}</small></div>
                <div class="field"><label>Payment status</label><select class="select" id="om-pay">${["pending", "paid", "failed", "refunded"].map((s) => `<option value="${s}" ${o.paymentStatus === s ? "selected" : ""}>${SE.PAYMENT[s][0]}</option>`).join("")}</select></div>
            </div>
            <h4 class="no-print" style="margin:20px 0 8px">History</h4>
            <div class="timeline">${o.timeline.slice().reverse().map((t) => `<div class="tl-step ${t.status === "cancelled" ? "is-cancelled" : ""}"><i></i><strong>${esc((SE.STATUS[t.status] || [t.status])[0])}</strong><small>${fmtDateTime(t.at)}${t.note ? " · " + esc(t.note) : ""}${t.by ? " · " + esc(t.by) : ""}</small></div>`).join("")}</div>`;
        const foot = document.createElement("div");
        foot.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        foot.innerHTML = '<button class="btn btn-outline" data-print>Print invoice</button><button class="btn btn-primary" data-save>Save changes</button>';
        const m = modal({ title: "Order details", body, footer: foot });
        m.el.querySelector(".modal").classList.add("wide");
        foot.querySelector("[data-print]").addEventListener("click", P.printModal);
        foot.querySelector("[data-save]").addEventListener("click", async (e) => {
            const status = $("#om-status", m.el).value, pay = $("#om-pay", m.el).value;
            const payload = {};
            if (pay !== o.paymentStatus) payload.paymentStatus = pay;
            if (status !== o.status && status !== "processing") payload.status = status;
            if (!Object.keys(payload).length) return m.close();
            if (payload.status === "cancelled" && !confirmAsk("Cancel this order? Stock will be returned.")) return;
            e.target.disabled = true;
            try {
                await api(`/api/admin/orders/${o.id}`, { method: "PUT", body: payload });
                m.close(); toast("Order updated"); P.reload();
            } catch (err) { toast(err.message, "error"); e.target.disabled = false; }
        });
    }

    /* ================= PRODUCTS ================= */
    let products = [], pFilter = "all", pQuery = "";
    async function productsView(host) {
        products = (await api("/api/admin/products")).products;
        await loadSettings();
        const hashF = new URLSearchParams((location.hash.split("?")[1] || "")).get("f");
        if (hashF) pFilter = hashF;
        drawProducts(host);
    }

    function drawProducts(host) {
        const tabs = [["all", "All"], ["live", "Live"], ["pending", "Awaiting approval"], ["draft", "Draft"], ["rejected", "Rejected"], ["archived", "Archived"]];
        const match = (p) => pFilter === "all" ? p.status !== "archived" : pFilter === "live" ? p.status === "active" && p.approved : p.status === pFilter;
        const q = pQuery.toLowerCase();
        const list = products.filter((p) => match(p) && (!q || (p.name + p.seller).toLowerCase().includes(q)));
        host.innerHTML = `${P.head("Products", `${products.length} products across all sellers.`, `<button class="btn btn-primary" id="add-product">${icon("plus", "icon icon-sm")}Add product</button>`)}
            <div class="toolbar"><input class="input search" id="p-search" placeholder="Search products or sellers" value="${esc(pQuery)}"><div class="tabs">${tabs.map(([k, l]) => `<button type="button" data-f="${k}" class="${pFilter === k ? "is-active" : ""}">${l}</button>`).join("")}</div></div>
            ${P.table(["Product", "Seller", "Price", "Stock", "Status", ""].map((h) => (h ? { label: h } : "")), list.map((p) => `<tr>
                <td><div class="cell-prod"><img class="thumb" src="${esc(imgSrc(p.image))}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.categoryName)} · #${p.id}</small></div></div></td>
                <td>${esc(p.seller)}</td><td>${money(p.price)}</td>
                <td>${p.stock <= 0 ? '<span class="pill pill-danger">Sold out</span>' : p.stock}</td>
                <td>${P.productStatusPill(p)}</td>
                <td><div class="row-actions">
                    ${p.status === "pending" ? `<button class="ia ok" data-act="approve" data-id="${p.id}">${icon("check", "icon icon-sm")}Approve</button><button class="ia danger" data-act="reject" data-id="${p.id}">Reject</button>` : ""}
                    ${p.status === "archived" ? `<button class="ia" data-act="restore" data-id="${p.id}">Restore</button>` : ""}
                    <button class="ia" data-edit="${p.id}">${icon("edit", "icon icon-sm")}Edit</button>
                    <button class="ia danger" data-del="${p.id}" aria-label="Delete">${icon("trash", "icon icon-sm")}</button></div></td></tr>`), "No products match.")}`;

        $("#p-search").addEventListener("input", SE.debounce((e) => { pQuery = e.target.value; drawProducts(host); const s = $("#p-search"); s.focus(); s.setSelectionRange(pQuery.length, pQuery.length); }, 250));
        $$("[data-f]", host).forEach((b) => b.addEventListener("click", () => { pFilter = b.dataset.f; drawProducts(host); }));
        const open = (product) => P.productForm({ product, base: "/api/admin/products", categories: settings.categories, isAdmin: true, onSaved: () => P.reload() });
        $("#add-product").addEventListener("click", () => open(null));
        $$("[data-edit]", host).forEach((b) => b.addEventListener("click", () => open(products.find((p) => p.id === Number(b.dataset.edit)))));
        $$("[data-act]", host).forEach((b) => b.addEventListener("click", async () => {
            let reason = "";
            if (b.dataset.act === "reject") { reason = prompt("Reason for rejecting (shown to the seller):", "Please improve the photos or description."); if (reason === null) return; }
            try { await api(`/api/admin/products/${b.dataset.id}`, { method: "PUT", body: { action: b.dataset.act, reason } }); toast("Updated"); P.reload(); }
            catch (e) { toast(e.message, "error"); }
        }));
        $$("[data-del]", host).forEach((b) => b.addEventListener("click", async () => {
            const p = products.find((x) => x.id === Number(b.dataset.del));
            if (!confirmAsk(`Delete "${p.name}"? If it has past orders it will be archived instead.`)) return;
            try { const r = await api(`/api/admin/products/${p.id}`, { method: "DELETE" }); toast(r.message); P.reload(); }
            catch (e) { toast(e.message, "error"); }
        }));
    }

    /* ================= USERS ================= */
    let users = [], uRole = "customer", uQuery = "";
    async function usersView(host) {
        users = (await api("/api/admin/users")).users;
        const hashRole = new URLSearchParams((location.hash.split("?")[1] || "")).get("role");
        if (hashRole) uRole = hashRole;
        drawUsers(host);
    }

    function drawUsers(host) {
        const roles = [["customer", "Customers"], ["seller", "Sellers"], ["admin", "Admins"]];
        const q = uQuery.toLowerCase();
        const list = users.filter((u) => u.role === uRole && (!q || (u.name + u.email).toLowerCase().includes(q)));
        const pendingCount = users.filter((u) => u.role === "seller" && u.status === "pending").length;
        host.innerHTML = `${P.head("Users", "Customers, sellers and staff.", `<button class="btn btn-primary" id="add-user">${icon("plus", "icon icon-sm")}Add user</button>`)}
            <div class="toolbar"><input class="input search" id="u-search" placeholder="Search by name or email" value="${esc(uQuery)}"><div class="tabs">${roles.map(([k, l]) => `<button type="button" data-r="${k}" class="${uRole === k ? "is-active" : ""}">${l}${k === "seller" && pendingCount ? ` <span class="nav-badge" style="display:inline-grid;margin-left:6px">${pendingCount}</span>` : ""}</button>`).join("")}</div></div>
            ${P.table(["Name", "Contact", uRole === "seller" ? "Products" : "Orders", uRole === "seller" ? "" : "Spent", "Status", "Joined", ""].filter((h) => h !== "").map((h) => ({ label: h })), list.map((u) => `<tr>
                <td><strong style="color:var(--ink)">${esc(u.name)}</strong>${u.shop ? `<br><small class="muted">${esc(u.shop.name)}</small>` : ""}</td>
                <td>${esc(u.email)}<br><small class="muted">${esc(u.phone || "")}</small></td>
                <td>${uRole === "seller" ? u.products : u.orders}</td>
                ${uRole === "seller" ? "" : `<td>${money(u.spent)}</td>`}
                <td>${u.status === "active" ? '<span class="pill pill-ok">Active</span>' : u.status === "pending" ? '<span class="pill pill-warn">Pending approval</span>' : '<span class="pill pill-danger">Blocked</span>'}</td>
                <td>${fmtDate(u.createdAt)}</td>
                <td><div class="row-actions">
                    ${u.status === "pending" ? `<button class="ia ok" data-st="active" data-id="${u.id}">${icon("check", "icon icon-sm")}Approve</button>` : ""}
                    ${u.status === "active" ? `<button class="ia danger" data-st="blocked" data-id="${u.id}">Block</button>` : ""}
                    ${u.status === "blocked" ? `<button class="ia" data-st="active" data-id="${u.id}">Unblock</button>` : ""}
                    <button class="ia" data-reset="${u.id}">Reset password</button></div></td></tr>`), "No users here.")}`;

        $("#u-search").addEventListener("input", SE.debounce((e) => { uQuery = e.target.value; drawUsers(host); const s = $("#u-search"); s.focus(); s.setSelectionRange(uQuery.length, uQuery.length); }, 250));
        $$("[data-r]", host).forEach((b) => b.addEventListener("click", () => { uRole = b.dataset.r; drawUsers(host); }));
        $("#add-user").addEventListener("click", addUserModal);
        $$("[data-st]", host).forEach((b) => b.addEventListener("click", async () => {
            if (b.dataset.st === "blocked" && !confirmAsk("Block this user? They will be signed out and unable to log in.")) return;
            try { await api(`/api/admin/users/${b.dataset.id}`, { method: "PUT", body: { status: b.dataset.st } }); toast("Updated"); P.reload(); }
            catch (e) { toast(e.message, "error"); }
        }));
        $$("[data-reset]", host).forEach((b) => b.addEventListener("click", async () => {
            if (!confirmAsk("Create a temporary password for this user? Their old password will stop working.")) return;
            try {
                const r = await api(`/api/admin/users/${b.dataset.reset}/reset-password`, { method: "POST", body: {} });
                modal({ title: "Temporary password", body: `<p>Share this password with the user securely. Ask them to change it after signing in.</p><p style="margin-top:14px;font-size:22px;font-weight:800;letter-spacing:.04em;color:var(--ink);user-select:all">${esc(r.tempPassword)}</p>` });
            } catch (e) { toast(e.message, "error"); }
        }));
    }

    function addUserModal() {
        const body = document.createElement("form");
        body.innerHTML = `<div class="form-grid">
            <div class="field"><label>Full name</label><input class="input" name="name" required maxlength="80"></div>
            <div class="field"><label>Role</label><select class="select" name="role"><option value="customer">Customer</option><option value="seller">Seller</option><option value="admin">Admin</option></select></div>
            <div class="field"><label>Email</label><input class="input" name="email" type="email" required></div>
            <div class="field"><label>Phone</label><input class="input" name="phone" maxlength="18"></div>
            <div class="field full"><label>Temporary password</label><input class="input" name="password" minlength="8" required><small>At least 8 characters. The user can change it after signing in.</small></div>
            <div class="full field-error" id="au-err"></div></div>`;
        const foot = document.createElement("div");
        foot.innerHTML = '<button class="btn btn-primary" type="button" id="au-save">Create user</button>';
        const m = modal({ title: "Add user", body, footer: foot });
        $("#au-save", m.el).addEventListener("click", async () => {
            try { await api("/api/admin/users", { method: "POST", body: Object.fromEntries(new FormData(body)) }); m.close(); toast("User created"); P.reload(); }
            catch (e) { $("#au-err", m.el).textContent = e.message; }
        });
    }

    /* ================= COUPONS ================= */
    async function couponsView(host) {
        const list = (await api("/api/admin/coupons")).coupons;
        host.innerHTML = `${P.head("Coupons", "Discount codes customers can use at checkout.", `<button class="btn btn-primary" id="add-coupon">${icon("plus", "icon icon-sm")}New coupon</button>`)}
            ${P.table(["Code", "Discount", "Minimum order", "Used", "Expires", "Active", ""].map((h) => (h ? { label: h } : "")), list.map((c) => `<tr>
                <td><b style="color:var(--ink);letter-spacing:.03em">${esc(c.code)}</b></td>
                <td>${c.type === "percent" ? c.value + "%" + (c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : "") : money(c.value)}</td>
                <td>${c.minOrder ? money(c.minOrder) : "None"}</td>
                <td>${c.used}${c.usageLimit ? " / " + c.usageLimit : ""}</td>
                <td>${c.expiresAt ? fmtDate(c.expiresAt) : "Never"}</td>
                <td><label class="switch"><input type="checkbox" data-toggle="${esc(c.code)}" ${c.active ? "checked" : ""}><i></i></label></td>
                <td><div class="row-actions"><button class="ia danger" data-del="${esc(c.code)}" aria-label="Delete">${icon("trash", "icon icon-sm")}</button></div></td></tr>`), "No coupons yet. Create one to run a promotion.")}`;
        $("#add-coupon").addEventListener("click", couponModal);
        $$("[data-toggle]", host).forEach((i) => i.addEventListener("change", async () => {
            try { await api(`/api/admin/coupons/${i.dataset.toggle}`, { method: "PUT", body: { active: i.checked } }); toast(i.checked ? "Coupon enabled" : "Coupon disabled"); }
            catch (e) { toast(e.message, "error"); }
        }));
        $$("[data-del]", host).forEach((b) => b.addEventListener("click", async () => {
            if (!confirmAsk(`Delete coupon ${b.dataset.del}?`)) return;
            try { await api(`/api/admin/coupons/${b.dataset.del}`, { method: "DELETE" }); toast("Deleted"); P.reload(); } catch (e) { toast(e.message, "error"); }
        }));
    }

    function couponModal() {
        const body = document.createElement("form");
        body.innerHTML = `<div class="form-grid">
            <div class="field"><label>Code</label><input class="input" name="code" required maxlength="30" placeholder="WELCOME10" style="text-transform:uppercase"></div>
            <div class="field"><label>Type</label><select class="select" name="type"><option value="percent">Percentage off</option><option value="fixed">Fixed amount off (NPR)</option></select></div>
            <div class="field"><label>Value</label><input class="input" name="value" type="number" min="1" required></div>
            <div class="field"><label>Minimum order (NPR)</label><input class="input" name="minOrder" type="number" min="0" placeholder="0"></div>
            <div class="field"><label>Max discount (NPR, % coupons)</label><input class="input" name="maxDiscount" type="number" min="0" placeholder="No limit"></div>
            <div class="field"><label>Usage limit</label><input class="input" name="usageLimit" type="number" min="0" placeholder="Unlimited"></div>
            <div class="field full"><label>Expires on (optional)</label><input class="input" name="expiresAt" type="date"></div>
            <div class="full field-error" id="cp-err"></div></div>`;
        const foot = document.createElement("div");
        foot.innerHTML = '<button class="btn btn-primary" type="button" id="cp-save">Create coupon</button>';
        const m = modal({ title: "New coupon", body, footer: foot });
        $("#cp-save", m.el).addEventListener("click", async () => {
            try { await api("/api/admin/coupons", { method: "POST", body: Object.fromEntries(new FormData(body)) }); m.close(); toast("Coupon created"); P.reload(); }
            catch (e) { $("#cp-err", m.el).textContent = e.message; }
        });
    }

    /* ================= REVIEWS ================= */
    async function reviewsView(host) {
        const list = (await api("/api/admin/reviews")).reviews;
        host.innerHTML = `${P.head("Reviews", "Remove reviews that are spam or abusive.")}
            ${P.table(["Product", "Customer", "Rating", "Review", "Date", ""].map((h) => (h ? { label: h } : "")), list.map((r) => `<tr>
                <td><strong style="color:var(--ink)">${esc(r.productName)}</strong></td><td>${esc(r.userName)}${r.verified ? '<br><span class="pill pill-ok">Verified</span>' : ""}</td>
                <td>${SE.stars(r.rating)}</td><td style="max-width:360px">${esc(r.comment || "—")}</td><td>${fmtDate(r.createdAt)}</td>
                <td><div class="row-actions"><button class="ia danger" data-del="${esc(r.id)}" aria-label="Delete review">${icon("trash", "icon icon-sm")}</button></div></td></tr>`), "No reviews yet.")}`;
        $$("[data-del]", host).forEach((b) => b.addEventListener("click", async () => {
            if (!confirmAsk("Delete this review?")) return;
            try { await api(`/api/admin/reviews/${b.dataset.del}`, { method: "DELETE" }); toast("Deleted"); P.reload(); } catch (e) { toast(e.message, "error"); }
        }));
    }

    /* ================= MESSAGES ================= */
    async function messagesView(host) {
        const list = (await api("/api/admin/messages")).messages;
        P.setBadge("messages", list.filter((m) => !m.read).length);
        host.innerHTML = `${P.head("Messages", "Enquiries from the contact form.")}
            ${P.table(["From", "Subject", "Received", ""].map((h) => (h ? { label: h } : "")), list.map((m) => `<tr class="msg-row ${m.read ? "" : "unread"}" data-open="${esc(m.id)}">
                <td><strong>${esc(m.name)}</strong><br><small class="muted">${esc(m.email)}</small></td><td>${esc(m.subject)}</td><td>${fmtDateTime(m.createdAt)}</td>
                <td><div class="row-actions"><button class="ia danger" data-del="${esc(m.id)}" aria-label="Delete message">${icon("trash", "icon icon-sm")}</button></div></td></tr>`), "No messages yet.")}`;
        $$("[data-open]", host).forEach((row) => row.addEventListener("click", async (e) => {
            if (e.target.closest("[data-del]")) return;
            const m = list.find((x) => x.id === row.dataset.open);
            modal({
                title: m.subject,
                body: `<p class="muted" style="margin-bottom:14px">${esc(m.name)} · ${esc(m.email)} · ${fmtDateTime(m.createdAt)}</p><p style="white-space:pre-wrap">${esc(m.message)}</p>`,
                footer: `<a class="btn btn-primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: " + m.subject)}">Reply by email</a>`,
                onClose: () => P.reload()
            });
            if (!m.read) api(`/api/admin/messages/${m.id}`, { method: "PUT", body: { read: true } }).catch(() => {});
        }));
        $$("[data-del]", host).forEach((b) => b.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirmAsk("Delete this message?")) return;
            try { await api(`/api/admin/messages/${b.dataset.del}`, { method: "DELETE" }); toast("Deleted"); P.reload(); } catch (err) { toast(err.message, "error"); }
        }));
    }

    /* ================= SETTINGS ================= */
    async function settingsView(host) {
        const s = await loadSettings(true);
        const sw = (name, title, sub, on) => `<div class="switch-row"><div><strong style="color:var(--ink)">${title}</strong><small>${sub}</small></div><label class="switch"><input type="checkbox" name="${name}" ${on ? "checked" : ""}><i></i></label></div>`;
        host.innerHTML = `${P.head("Settings", "Store details, delivery, payments and marketplace rules.")}
        <form id="settings-form" class="stack" style="max-width:820px">
            <div class="box"><h3>Store details</h3><div class="form-grid">
                <div class="field"><label>Store name</label><input class="input" name="storeName" value="${esc(s.storeName)}" maxlength="60"></div>
                <div class="field"><label>Support email</label><input class="input" name="email" type="email" value="${esc(s.email)}"><small>Shown in the footer and contact page.</small></div>
                <div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(s.phone)}" placeholder="+977 98XXXXXXXX"></div>
                <div class="field"><label>Address</label><input class="input" name="address" value="${esc(s.address)}"></div>
                <div class="field full"><label>Tagline</label><input class="input" name="tagline" value="${esc(s.tagline)}" maxlength="140"></div>
                <div class="field full"><label>Announcement bar (top of every page)</label><input class="input" name="announcement" value="${esc(s.announcement)}" maxlength="200"><small>Leave empty to hide it.</small></div>
            </div></div>
            <div class="box"><h3>Delivery</h3><div class="form-grid">
                <div class="field"><label>Delivery charge (NPR)</label><input class="input" name="shippingFee" type="number" min="0" value="${s.shippingFee}"></div>
                <div class="field"><label>Free delivery above (NPR)</label><input class="input" name="freeShippingThreshold" type="number" min="0" value="${s.freeShippingThreshold}"><small>Set 0 to always charge delivery.</small></div>
            </div></div>
            <div class="box"><h3>Payments</h3>
                ${sw("codEnabled", "Cash on delivery", "Customers pay when the order arrives.", s.codEnabled)}
                ${sw("onlineEnabled", "eSewa, Khalti or bank transfer", "Customers pay in advance and enter the transaction ID. You confirm payment in Orders.", s.onlineEnabled)}
                <div class="field" style="margin-top:14px"><label>Payment instructions shown at checkout</label><textarea class="textarea" name="onlineInstructions" style="min-height:90px" maxlength="500" placeholder="e.g. eSewa ID: 98XXXXXXXX (Your Shop). Bank: …, A/C: …">${esc(s.onlineInstructions)}</textarea></div>
            </div>
            <div class="box"><h3>Marketplace</h3><div class="form-grid">
                <div class="field"><label>Seller commission (%)</label><input class="input" name="commissionPercent" type="number" min="0" max="90" value="${s.commissionPercent}"><small>Used to calculate seller earnings in their dashboard.</small></div>
                <div class="field"><label>Low-stock alert at</label><input class="input" name="lowStockAt" type="number" min="0" value="${s.lowStockAt}"></div>
            </div>
                ${sw("autoApproveProducts", "Auto-approve seller products", "Skip manual review. Not recommended until you trust your sellers.", s.autoApproveProducts)}
            </div>
            <div class="box"><h3>Categories</h3><div id="cat-list"></div>
                <button class="btn btn-outline btn-sm" type="button" id="cat-add">${icon("plus", "icon icon-sm")}Add category</button></div>
            <div class="box"><h3>Social links</h3><div class="form-grid">
                ${["instagram", "facebook", "twitter"].map((k) => `<div class="field"><label style="text-transform:capitalize">${k}</label><input class="input" name="social_${k}" value="${esc(s.socials[k] || "")}" placeholder="https://"></div>`).join("")}
            </div></div>
            <div class="alert alert-error" id="st-err" hidden></div>
            <div><button class="btn btn-primary btn-lg" type="submit">Save settings</button></div>
        </form>`;

        let cats = s.categories.map((c) => ({ ...c }));
        const drawCats = () => {
            $("#cat-list").innerHTML = cats.map((c, i) => `<div class="cat-edit"><input class="input" data-cat="${i}" value="${esc(c.name)}" maxlength="40"><button class="ia danger" type="button" data-rm="${i}" aria-label="Remove category">${icon("trash", "icon icon-sm")}</button></div>`).join("");
        };
        drawCats();
        $("#cat-list").addEventListener("input", (e) => { if (e.target.dataset.cat !== undefined) cats[Number(e.target.dataset.cat)].name = e.target.value; });
        $("#cat-list").addEventListener("click", (e) => { const rm = e.target.closest("[data-rm]"); if (rm) { cats.splice(Number(rm.dataset.rm), 1); drawCats(); } });
        $("#cat-add").addEventListener("click", () => { cats.push({ slug: "", name: "" }); drawCats(); });

        $("#settings-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            const has = (n) => e.target.elements[n] && e.target.elements[n].checked;
            const body = {
                storeName: f.get("storeName"), email: f.get("email"), phone: f.get("phone"), address: f.get("address"), tagline: f.get("tagline"), announcement: f.get("announcement"),
                shippingFee: f.get("shippingFee"), freeShippingThreshold: f.get("freeShippingThreshold"), commissionPercent: f.get("commissionPercent"), lowStockAt: f.get("lowStockAt"),
                codEnabled: has("codEnabled"), onlineEnabled: has("onlineEnabled"), autoApproveProducts: has("autoApproveProducts"), onlineInstructions: f.get("onlineInstructions"),
                socials: { instagram: f.get("social_instagram"), facebook: f.get("social_facebook"), twitter: f.get("social_twitter") },
                categories: cats.filter((c) => c.name.trim())
            };
            try {
                const r = await api("/api/admin/settings", { method: "PUT", body });
                settings = r.settings;
                $("#st-err").hidden = true;
                toast("Settings saved");
            } catch (err) { $("#st-err").textContent = err.message; $("#st-err").hidden = false; $("#st-err").scrollIntoView({ block: "center" }); }
        });
    }

    P.mount({
        role: "admin",
        title: "Admin",
        home: "dashboard",
        nav: [
            { key: "dashboard", label: "Dashboard", icon: "grid" },
            { key: "orders", label: "Orders", icon: "receipt" },
            { key: "products", label: "Products", icon: "package" },
            { key: "users", label: "Users", icon: "users" },
            { key: "coupons", label: "Coupons", icon: "tag" },
            { key: "reviews", label: "Reviews", icon: "star" },
            { key: "messages", label: "Messages", icon: "mail" },
            { key: "settings", label: "Settings", icon: "settings" }
        ],
        views: { dashboard, orders: ordersView, products: productsView, users: usersView, coupons: couponsView, reviews: reviewsView, messages: messagesView, settings: settingsView }
    });
})();
