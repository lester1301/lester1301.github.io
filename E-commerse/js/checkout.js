/* Checkout page */
(function () {
    const { $, $$, esc, money, App, Catalog, Cart, Auth, Settings, api, toast, icon, imgSrc, link, fmtDate } = SE;
    let quote = null, placing = false, seq = 0;

    const fields = ["name", "email", "phone", "address", "city", "postalCode"];

    function paymentBlock() {
        const s = Settings.get();
        const opts = [];
        if (s.codEnabled) opts.push(`<label class="pay-opt"><input type="radio" name="pay" value="cod" checked><div><strong>Cash on delivery</strong><small>Pay in cash when your order arrives.</small></div></label>`);
        if (s.onlineEnabled) opts.push(`<label class="pay-opt"><input type="radio" name="pay" value="online" ${s.codEnabled ? "" : "checked"}><div><strong>eSewa, Khalti or bank transfer</strong><small>Pay now and enter your transaction ID. We confirm within a few hours.</small></div></label>
            <div class="pay-extra" id="pay-online" hidden>
                ${s.onlineInstructions ? `<div class="alert alert-info">${esc(s.onlineInstructions)}</div>` : ""}
                <div class="field"><label for="payRef">Transaction ID (optional)</label><input class="input" id="payRef" maxlength="60" placeholder="e.g. 0AB12CD"><small>You can also add it later by contacting us with your order number.</small></div>
            </div>`);
        $("#pay-block").innerHTML = opts.join("");
        togglePay();
    }

    function togglePay() {
        const online = $("input[name=pay]:checked");
        const box = $("#pay-online");
        if (box) box.hidden = !(online && online.value === "online");
    }

    async function renderSummary() {
        const lines = Cart.lines();
        const mine = ++seq;
        quote = await Cart.quote();
        if (mine !== seq) return;
        $("#sum-items").innerHTML = lines.map((l) => `<div class="mini-line"><img src="${esc(imgSrc(l.product.image))}" alt=""><div><div style="font-weight:600;color:var(--ink)">${esc(l.product.name)}</div><span class="qty-badge">${l.size ? `Size ${esc(l.size)} · ` : ""}Qty ${l.quantity}</span></div><b>${money(l.product.price * l.quantity)}</b></div>`).join("");
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
                <div><span>Payment</span><strong>${order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment (awaiting confirmation)"}</strong></div>
                <div><span>Deliver to</span><strong>${esc(order.shipping.address)}, ${esc(order.shipping.city)}</strong></div>
            </div>
            ${order.paymentMethod === "online" && s.onlineInstructions ? `<div class="alert alert-info" style="text-align:left;margin-bottom:20px">${esc(s.onlineInstructions)}${order.paymentRef ? "" : " Please send your transaction ID with order number <b>" + esc(order.id) + "</b> using our contact page."}</div>` : ""}
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                <a class="btn btn-primary" href="${link("track.html")}?id=${encodeURIComponent(order.id)}">Track order</a>
                <a class="btn btn-outline" href="${link("products.html")}">Continue shopping</a>
            </div></div>`;
        window.scrollTo({ top: 0, behavior: "smooth" });
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
        const btn = $("#place-btn");
        placing = true;
        btn.disabled = true;
        btn.firstElementChild.textContent = "Placing your order…";

        try {
            const res = await api("/api/orders", {
                method: "POST",
                body: {
                    items: Cart.read().map((l) => ({ id: l.id, quantity: l.quantity, size: l.size })),
                    customer: { name: $("#f-name").value, email: $("#f-email").value, phone: $("#f-phone").value },
                    shipping: { address: $("#f-address").value, city: $("#f-city").value, postalCode: $("#f-postalCode").value },
                    paymentMethod: pay,
                    paymentRef: pay === "online" ? ($("#payRef") || {}).value : "",
                    notes: $("#f-notes").value,
                    couponCode: quote && quote.code,
                    expectedTotal: quote && quote.total
                }
            });
            Cart.clear();
            Cart.setCoupon(null);
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

    App.start(() => {
        if (Cart.count() === 0) {
            $("#checkout-root").innerHTML = `<div class="empty">${icon("bag")}<h2>Your cart is empty</h2><p>Add a few items before checking out.</p><a class="btn btn-primary" href="${link("products.html")}">Browse products</a></div>`;
            return;
        }
        paymentBlock();
        prefill();
        Catalog.subscribe(() => { if (Cart.count() && $("#sum-items")) renderSummary(); });
        window.addEventListener("cart:change", () => { if (Cart.count() && $("#sum-items")) renderSummary(); });
        $("#checkout-form").addEventListener("submit", place);
        $("#checkout-form").addEventListener("input", () => { $("#form-error").hidden = true; });
        $("#pay-block").addEventListener("change", togglePay);
        App.onSettings = paymentBlock;
    });
})();
