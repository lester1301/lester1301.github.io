/* Track order (works for guests) */
(function () {
    const { $, esc, money, App, api, fmtDateTime, fmtDate, statusPill, paymentPill, imgSrc, link, Auth } = SE;

    const STEPS = [["pending", "Placed"], ["confirmed", "Confirmed"], ["shipped", "Shipped"], ["delivered", "Delivered"]];

    function progress(status) {
        if (status === "cancelled") return '<div class="alert alert-error">This order was cancelled.</div>';
        const idx = status === "processing" ? 1 : Math.max(0, STEPS.findIndex((s) => s[0] === status));
        return `<div class="steps">${STEPS.map((s, i) => `<div class="${i <= idx ? "done" : ""}">${s[1]}</div>`).join("")}</div>`;
    }

    function orderHTML(o) {
        return `<div class="card">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
                <div><h2 style="margin:0">Order ${esc(o.id)}</h2><span class="muted">Placed ${fmtDate(o.createdAt)}</span></div>
                <div style="display:flex;gap:8px">${statusPill(o.status)}${paymentPill(o.paymentStatus)}</div>
            </div>
            ${progress(o.status)}
            <div class="divider" style="margin:20px 0"></div>
            ${o.items.map((i) => `<div class="order-item"><img src="${esc(imgSrc(i.image))}" alt=""><div><strong style="color:var(--ink)">${esc(i.name)}</strong><br><span class="muted">${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.quantity} · ${esc((SE.STATUS[i.status] || [i.status])[0])}</span></div><b>${money(i.price * i.quantity)}</b></div>`).join("")}
            <div class="divider" style="margin:14px 0"></div>
            <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
            ${o.discount ? `<div class="sum-row"><span>Discount</span><span class="discount">− ${money(o.discount)}</span></div>` : ""}
            <div class="sum-row"><span>Delivery</span><span>${o.shippingFee ? money(o.shippingFee) : "Free"}</span></div>
            <div class="sum-row total" style="margin-top:8px"><span>Total</span><span>${money(o.total)}</span></div>
            <div class="divider" style="margin:20px 0"></div>
            <h3 style="font-size:16px;margin-bottom:10px">Delivering to</h3>
            <p>${esc(o.customer.name)}<br>${esc(o.shipping.address)}, ${esc(o.shipping.city)}${o.shipping.postalCode ? " " + esc(o.shipping.postalCode) : ""}<br>${esc(o.customer.phone)}</p>
            <h3 style="font-size:16px;margin:22px 0 10px">Order history</h3>
            <div class="timeline">${o.timeline.slice().reverse().map((t) => `<div class="tl-step ${t.status === "cancelled" ? "is-cancelled" : ""}"><i></i><strong>${esc((SE.STATUS[t.status] || [t.status])[0])}</strong><small>${fmtDateTime(t.at)}${t.note ? " · " + esc(t.note) : ""}</small></div>`).join("")}</div>
        </div>`;
    }

    async function lookup(id, contact) {
        const box = $("#track-result"), err = $("#track-error"), btn = $("#track-btn");
        err.hidden = true;
        btn.disabled = true;
        btn.textContent = "Looking…";
        try {
            const res = await api("/api/orders/track", { method: "POST", body: { orderId: id, contact }, auth: false });
            box.innerHTML = orderHTML(res.order);
        } catch (e) {
            box.innerHTML = "";
            err.textContent = e.message;
            err.hidden = false;
        } finally {
            btn.disabled = false;
            btn.textContent = "Track order";
        }
    }

    App.start(() => {
        const params = new URLSearchParams(location.search);
        if (params.get("id")) $("#t-id").value = params.get("id");
        const user = Auth.user();
        if (user && Auth.isLoggedIn()) $("#t-contact").value = user.email;

        $("#track-form").addEventListener("submit", (e) => {
            e.preventDefault();
            lookup($("#t-id").value.trim(), $("#t-contact").value.trim());
        });
        if (params.get("id") && $("#t-contact").value) lookup($("#t-id").value, $("#t-contact").value);
    });
})();
