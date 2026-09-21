/* Cart page */
(function () {
    const { $, $$, esc, money, App, Catalog, Cart, Settings, api, toast, icon, imgSrc, link } = SE;
    let seq = 0;

    function empty() {
        $("#cart-root").innerHTML = `<div class="empty">${icon("bag")}<h2>Your cart is empty</h2><p>Looks like you haven't added anything yet. Have a look at what's new.</p><a class="btn btn-primary" href="${link("products.html")}">Start shopping</a></div>`;
    }

    async function render() {
        // never keep more in the cart than is in stock
        let clamped = false;
        Cart.lines().forEach((l) => {
            if (l.product.stock > 0 && l.quantity > l.product.stock) { Cart.setQty(l.id, l.size, l.product.stock); clamped = true; }
        });
        if (clamped) return;

        const lines = Cart.lines();
        if (!lines.length) return empty();

        const mine = ++seq;
        const q = await Cart.quote();
        if (mine !== seq) return; // a newer render is in progress

        const s = Settings.get();
        const blocked = lines.some((l) => l.product.stock <= 0);
        const remaining = s.freeShippingThreshold - (q.subtotal - q.discount);
        const progress = s.freeShippingThreshold > 0 ? Math.min(100, Math.round(((q.subtotal - q.discount) / s.freeShippingThreshold) * 100)) : 0;

        $("#cart-root").innerHTML = `
        <div class="cart-layout">
            <div>
                ${lines.map((l) => {
                    const p = l.product, out = p.stock <= 0;
                    return `<div class="cart-line">
                        <a href="${link("product.html")}?id=${p.id}"><img src="${esc(imgSrc(p.image))}" alt="${esc(p.name)}"></a>
                        <div>
                            <h3><a href="${link("product.html")}?id=${p.id}">${esc(p.name)}</a></h3>
                            <div class="meta">${l.size ? `Size ${esc(l.size)} · ` : ""}${money(p.price)} each</div>
                            ${out ? '<span class="pill pill-danger">Sold out, please remove</span>' : `<div class="qty"><button type="button" data-dec data-id="${p.id}" data-size="${esc(l.size)}" aria-label="Decrease quantity">${icon("minus", "icon icon-sm")}</button><span>${l.quantity}</span><button type="button" data-inc data-id="${p.id}" data-size="${esc(l.size)}" aria-label="Increase quantity">${icon("plus", "icon icon-sm")}</button></div>`}
                        </div>
                        <div class="right"><span class="line-total">${money(p.price * l.quantity)}</span><button class="remove-btn" type="button" data-remove data-id="${p.id}" data-size="${esc(l.size)}">Remove</button></div>
                    </div>`;
                }).join("")}
                <p style="margin-top:22px"><a class="link" href="${link("products.html")}">← Continue shopping</a></p>
            </div>
            <aside class="summary">
                <h2>Order summary</h2>
                ${s.freeShippingThreshold > 0 ? `<div class="ship-progress">${remaining > 0 ? `Add <b>${money(remaining)}</b> more for free delivery` : "<b>You've unlocked free delivery</b>"}<div class="bar"><i style="width:${progress}%"></i></div></div>` : ""}
                <div class="coupon-row"><input class="input" id="coupon" placeholder="Coupon code" value="${esc(q.code)}" ${q.code ? "readonly" : ""}><button class="btn btn-dark" id="coupon-btn" type="button">${q.code ? "Remove" : "Apply"}</button></div>
                ${q.error ? `<div class="field-error">${esc(q.error)}</div>` : ""}
                <div class="sum-row"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
                ${q.discount ? `<div class="sum-row"><span>Coupon ${esc(q.code)}${q.note ? ` (${esc(q.note)})` : ""}</span><span class="discount">− ${money(q.discount)}</span></div>` : ""}
                <div class="sum-row"><span>Delivery</span><span>${q.shipping === 0 ? "Free" : money(q.shipping)}</span></div>
                <div class="sum-row total"><span>Total</span><span>${money(q.total)}</span></div>
                <a class="btn btn-primary btn-lg ${blocked ? "is-disabled" : ""}" href="${link("checkout.html")}">Checkout</a>
                ${blocked ? '<div class="field-error">Remove sold-out items to continue.</div>' : ""}
            </aside>
        </div>`;
    }

    App.start(() => {
        $("#cart-root").innerHTML = '<div class="skeleton" style="height:260px"></div>';
        Catalog.subscribe(() => { render(); });
        window.addEventListener("cart:change", render);

        document.addEventListener("click", async (e) => {
            const t = e.target;
            const btn = t.closest("[data-inc],[data-dec],[data-remove]");
            if (btn) {
                const id = Number(btn.dataset.id), size = btn.dataset.size || "";
                const line = Cart.read().find((l) => l.id === id && l.size === size);
                if (btn.hasAttribute("data-remove")) Cart.remove(id, size);
                else if (line) {
                    const before = line.quantity;
                    Cart.setQty(id, size, line.quantity + (btn.hasAttribute("data-inc") ? 1 : -1));
                    if (btn.hasAttribute("data-inc") && Cart.read().find((l) => l.id === id && l.size === size).quantity === before) toast("That's all we have in stock", "error");
                }
                return;
            }
            if (t.closest("#coupon-btn")) {
                if (Cart.coupon()) { Cart.setCoupon(null); return render(); }
                const code = $("#coupon").value.trim();
                if (!code) return toast("Enter a coupon code", "error");
                try {
                    const r = await api("/api/coupons/validate", { method: "POST", body: { code, subtotal: Cart.subtotal() }, auth: false });
                    Cart.setCoupon({ code: r.code, discount: r.discount, description: r.description });
                    toast(`Coupon ${r.code} applied`);
                    render();
                } catch (err) { toast(err.message, "error"); }
            }
        });
    });
})();
