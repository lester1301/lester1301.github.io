/* Checkout page */
(function () {
    const { $, $$, esc, money, App, Catalog, Cart, Auth, Settings, api, toast, icon, imgSrc, link, fmtDate } = SE;
    let quote = null, placing = false, seq = 0;

    const fields = ["name", "email", "phone", "address", "city", "postalCode"];

    function paymentBlock() {
        const s = Settings.get();
        const opts = [];
        if (s.codEnabled) opts.push(`<label class="pay-opt"><input type="radio" name="pay" value="cod" checked><div><strong>Cash on delivery</strong><small>Pay in cash when your order arrives.</small></div></label>`);
        if (s.onlineEnabled) {
            opts.push(`<label class="pay-opt"><input type="radio" name="pay" value="online" ${s.codEnabled ? "" : "checked"}><div><strong>Pay online</strong><small>eSewa, Khalti or a manual bank transfer.</small></div></label>
            <div class="pay-extra" id="pay-online" hidden>
                <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
                    <label class="pay-opt" style="padding:12px"><input type="radio" name="online-method" value="esewa" checked><div><strong style="font-size:14px">eSewa</strong></div></label>
                    <label class="pay-opt" style="padding:12px"><input type="radio" name="online-method" value="khalti"><div><strong style="font-size:14px">Khalti</strong></div></label>
                    <label class="pay-opt" style="padding:12px"><input type="radio" name="online-method" value="bank"><div><strong style="font-size:14px">Bank transfer</strong></div></label>
                </div>
                <div id="pay-esewa-note" class="alert alert-info" style="margin-top:12px">You'll be taken to eSewa to complete your payment securely, then brought back here.</div>
                <div id="pay-khalti-note" class="alert alert-info" style="margin-top:12px" hidden>You'll be taken to Khalti to complete your payment securely, then brought back here.</div>
                <div id="pay-bank-note" hidden style="margin-top:12px">
                    ${s.bankDetails ? `<div class="alert alert-info" style="white-space:pre-line">${esc(s.bankDetails)}</div>` : s.onlineInstructions ? `<div class="alert alert-info">${esc(s.onlineInstructions)}</div>` : ""}
                    <div class="field" style="margin-top:12px"><label for="payRef">Transaction ID (optional)</label><input class="input" id="payRef" maxlength="60" placeholder="e.g. 0AB12CD"><small>You can also add it later by contacting us with your order number.</small></div>
                </div>
            </div>`);
        }
        $("#pay-block").innerHTML = opts.join("");
        togglePay();
    }

    function togglePay() {
        const online = $("input[name=pay]:checked");
        const box = $("#pay-online");
        if (box) box.hidden = !(online && online.value === "online");
        const method = ($("input[name='online-method']:checked") || {}).value || "esewa";
        const notes = { esewa: "#pay-esewa-note", khalti: "#pay-khalti-note", bank: "#pay-bank-note" };
        for (const [k, sel] of Object.entries(notes)) { const el = $(sel); if (el) el.hidden = k !== method; }
    }

    async function renderSummary() {
        const lines = Cart.lines();
        const mine = ++seq;
        const city = ($("#f-city") || {}).value || "";
        quote = await Cart.quote(city);
        if (mine !== seq) return;
        $("#sum-items").innerHTML = lines.map((l) => `<div class="mini-line"><img src="${esc(imgSrc(l.product.image))}" alt=""><div><div style="font-weight:600;color:var(--ink)">${esc(l.product.name)}</div><span class="qty-badge">${[l.size && `Size ${esc(l.size)}`, l.color && esc(l.color)].filter(Boolean).join(" · ")}${l.size || l.color ? " · " : ""}Qty ${l.quantity}</span></div><b>${money(l.product.price * l.quantity)}</b></div>`).join("");
        $("#sum-rows").innerHTML = `
            <div class="sum-row"><span>Subtotal</span><span>${money(quote.subtotal)}</span></div>
            ${quote.discount ? `<div class="sum-row"><span>Coupon ${esc(quote.code)}</span><span class="discount">− ${money(quote.discount)}</span></div>` : ""}
            <div class="sum-row"><span>Delivery</span><span>${quote.shipping === 0 ? "Free" : money(quote.shipping)}</span></div>
            <div class="sum-row total"><span>Total</span><span>${money(quote.total)}</span></div>`;
        $("#place-total").textContent = money(quote.total);
    }

    async function prefill() {
        const user = Auth.user();
        if (!user || !Auth.isLoggedIn()) {
            $("#guest-note").hidden = false;
            return;
        }
        $("#f-name").value = user.name || "";
        $("#f-email").value = user.email || "";
        $("#f-phone").value = user.phone || "";
        try {
            const acc = await api("/api/account");
            if (acc.addresses.length) {
                const host = $("#saved-addr");
                host.hidden = false;
                host.innerHTML = '<span class="field-label" style="width:100%">Use a saved address</span>' +
                    acc.addresses.map((a, i) => `<button type="button" data-addr="${i}">${esc(a.label)}: ${esc(a.address)}</button>`).join("");
                host.onclick = (e) => {
                    const b = e.target.closest("[data-addr]");
                    if (!b) return;
                    const a = acc.addresses[Number(b.dataset.addr)];
                    $("#f-name").value = a.name || user.name;
                    $("#f-phone").value = a.phone || user.phone || "";
                    $("#f-address").value = a.address;
                    $("#f-city").value = a.city;
                    $("#f-postalCode").value = a.postalCode || "";
                };
            }
        } catch (e) { /* not critical */ }
    }

    function validate() {
        const v = (id) => $("#f-" + id).value.trim();
        if (v("name").length < 2) return ["name", "Please enter your full name."];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email"))) return ["email", "Please enter a valid email address."];
        if (!/^[0-9+\-\s()]{7,18}$/.test(v("phone"))) return ["phone", "Please enter a valid phone number."];
        if (v("address").length < 4) return ["address", "Please enter your delivery address."];
        if (v("city").length < 2) return ["city", "Please enter your city."];
        return null;
    }

    function showSuccess(order) {
        const s = Settings.get();
        $("#checkout-root").innerHTML = `<div class="success">
            <div class="success-mark">${icon("check")}</div>
            <h1>Thank you, ${esc(order.customer.name.split(" ")[0])}!</h1>
            <p class="muted">Your order has been placed. We've kept a copy on your account${Auth.isLoggedIn() ? "" : ", and you can track it using the order number below"}.</p>
            <div class="kv">
                <div><span>Order number</span><strong>${esc(order.id)}</strong></div>
                <div><span>Total</span><strong>${money(order.total)}</strong></div>
                <div><span>Payment</span><strong>${order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentStatus === "paid" ? "Paid online" : "Online payment (awaiting confirmation)"}</strong></div>
                <div><span>Deliver to</span><strong>${esc(order.shipping.address)}, ${esc(order.shipping.city)}</strong></div>
            </div>
            ${order.paymentMethod === "online" && order.paymentStatus !== "paid" ? `<div class="alert alert-info" style="text-align:left;margin-bottom:20px">${esc(s.bankDetails || s.onlineInstructions)}${order.paymentRef ? "" : " Please send your transaction ID with order number <b>" + esc(order.id) + "</b> using our contact page."}</div>` : ""}
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                <a class="btn btn-primary" href="${link("track.html")}?id=${encodeURIComponent(order.id)}">Track order</a>
                <a class="btn btn-outline" href="${link("products.html")}">Continue shopping</a>
            </div></div>`;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* Auto-submits a hidden form to eSewa's gateway (standard EPay v2 redirect flow). */
    function redirectToEsewa(gatewayUrl, fields) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = gatewayUrl;
        for (const [k, v] of Object.entries(fields)) {
            const input = document.createElement("input");
            input.type = "hidden"; input.name = k; input.value = v;
            form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
    }

    async function place(e) {
        e.preventDefault();
        if (placing) return;
        $("#form-error").hidden = true;

        const bad = validate();
        if (bad) {
            $("#f-" + bad[0]).focus();
            $("#form-error").textContent = bad[1];
            $("#form-error").hidden = false;
            return;
        }
        const pay = ($("input[name=pay]:checked") || {}).value || "cod";
        const onlineMethod = pay === "online" ? (($("input[name='online-method']:checked") || {}).value || "esewa") : "";
        const btn = $("#place-btn");
        placing = true;
        btn.disabled = true;
        btn.firstElementChild.textContent = "Placing your order…";

        try {
            const res = await api("/api/orders", {
                method: "POST",
                body: {
                    items: Cart.read().map((l) => ({ id: l.id, quantity: l.quantity, size: l.size, color: l.color })),
                    customer: { name: $("#f-name").value, email: $("#f-email").value, phone: $("#f-phone").value },
                    shipping: { address: $("#f-address").value, city: $("#f-city").value, postalCode: $("#f-postalCode").value },
                    paymentMethod: pay,
                    paymentRef: onlineMethod === "bank" ? ($("#payRef") || {}).value : "",
                    notes: $("#f-notes").value,
                    couponCode: quote && quote.code,
                    expectedTotal: quote && quote.total
                }
            });
            Cart.clear();
            Cart.setCoupon(null);
            SE.writeJSON("se_checkout_order", res.order);

            if (onlineMethod === "esewa") {
                const init = await api("/api/payments/esewa/initiate", { method: "POST", auth: false, body: { orderId: res.order.id, origin: location.origin + location.pathname.replace(/\/[^/]*$/, "") } });
                return redirectToEsewa(init.gatewayUrl, init.fields); // leaves the page
            }
            if (onlineMethod === "khalti") {
                const init = await api("/api/payments/khalti/initiate", { method: "POST", auth: false, body: { orderId: res.order.id, origin: location.origin + location.pathname.replace(/\/[^/]*$/, "") } });
                location.href = init.paymentUrl; // leaves the page
                return;
            }
            showSuccess(res.order);
            Catalog.load();
        } catch (err) {
            $("#form-error").textContent = err.message;
            $("#form-error").hidden = false;
            $("#form-error").scrollIntoView({ block: "center", behavior: "smooth" });
            if (err.status === 409 || err.status === 400) { await Catalog.load(); renderSummary(); }
        } finally {
            placing = false;
            btn.disabled = false;
            btn.firstElementChild.textContent = "Place order";
        }
    }

    /* Handles the browser coming back from eSewa or Khalti. */
    async function handleReturn() {
        const params = new URLSearchParams(location.search);
        const cached = SE.readJSON("se_checkout_order", null);

        if (params.get("esewa") === "success" && params.has("data")) {
            $("#checkout-root").innerHTML = '<div class="skeleton" style="height:200px"></div>';
            try {
                const res = await api("/api/payments/esewa/verify", { method: "POST", auth: false, body: { data: params.get("data") } });
                return showSuccess(res.order);
            } catch (err) { return showPaymentFailed(err.message, cached); }
        }
        if (params.get("esewa") === "failure") return showPaymentFailed("Your eSewa payment was not completed.", cached);

        if (params.get("khalti") === "return") {
            const pidx = params.get("pidx");
            const status = params.get("status");
            $("#checkout-root").innerHTML = '<div class="skeleton" style="height:200px"></div>';
            if (status && status !== "Completed") return showPaymentFailed("Your Khalti payment was not completed.", cached);
            try {
                const res = await api("/api/payments/khalti/verify", { method: "POST", auth: false, body: { pidx } });
                return showSuccess(res.order);
            } catch (err) { return showPaymentFailed(err.message, cached); }
        }
        return false;
    }

    function showPaymentFailed(message, order) {
        $("#checkout-root").innerHTML = `<div class="empty">${icon("alert")}<h2>Payment not completed</h2><p>${esc(message)} ${order ? `Your order <b>${esc(order.id)}</b> is saved — you can try paying again from Track order, or choose cash on delivery next time.` : ""}</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">${order ? `<a class="btn btn-primary" href="${link("track.html")}?id=${encodeURIComponent(order.id)}">Track this order</a>` : ""}<a class="btn btn-outline" href="${link("products.html")}">Continue shopping</a></div></div>`;
        return true;
    }

    App.start(async () => {
        const params = new URLSearchParams(location.search);
        const isReturning = params.has("esewa") || params.has("khalti");
        if (isReturning) {
            await Catalog.load();
            if (await handleReturn()) return;
        }
        if (Cart.count() === 0 && !isReturning) {
            $("#checkout-root").innerHTML = `<div class="empty">${icon("bag")}<h2>Your cart is empty</h2><p>Add a few items before checking out.</p><a class="btn btn-primary" href="${link("products.html")}">Browse products</a></div>`;
            return;
        }
        paymentBlock();
        prefill();
        Catalog.subscribe(() => { if (Cart.count() && $("#sum-items")) renderSummary(); });
        window.addEventListener("cart:change", () => { if (Cart.count() && $("#sum-items")) renderSummary(); });
        $("#checkout-form").addEventListener("submit", place);
        $("#checkout-form").addEventListener("input", () => { $("#form-error").hidden = true; });
        $("#f-city").addEventListener("input", SE.debounce(renderSummary, 400));
        $("#pay-block").addEventListener("change", togglePay);
        App.onSettings = paymentBlock;
    });
})();
