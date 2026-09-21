/* AI shopping assistant widget (backend: POST /api/chat) */
(function () {
    const { $, esc, money, API, Catalog, Cart, Settings, icon, imgSrc, link, toast, readJSON, writeJSON } = SE;
    const KEY = "se_chat";
    let history = readJSON(KEY, []);   // [{ role: "user"|"model", text, ids? }]
    let busy = false;

    function build() {
        const wrap = document.createElement("div");
        wrap.innerHTML = `
            <button class="chat-fab" id="chat-fab" type="button" aria-label="Open shopping assistant">${icon("chat")}</button>
            <section class="chat-win" id="chat-win" role="dialog" aria-label="Shopping assistant">
                <div class="chat-head"><div><h3>${esc(Settings.get().storeName)} assistant</h3><small>Ask about products, prices or delivery</small></div>
                    <button class="icon-btn" id="chat-close" type="button" style="color:#fff" aria-label="Close">${icon("x")}</button></div>
                <div class="chat-msgs" id="chat-msgs" aria-live="polite"></div>
                <form class="chat-input" id="chat-form"><input id="chat-input" maxlength="500" autocomplete="off" placeholder="Type your question"><button type="submit" aria-label="Send" id="chat-send">${icon("send", "icon icon-sm")}</button></form>
            </section>`;
        document.body.appendChild(wrap);

        $("#chat-fab").addEventListener("click", toggle);
        $("#chat-close").addEventListener("click", toggle);
        $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); send($("#chat-input").value); });
        $("#chat-msgs").addEventListener("click", (e) => {
            const chip = e.target.closest("[data-chip]");
            if (chip) return send(chip.dataset.chip);
            const add = e.target.closest("[data-chat-add]");
            if (add) {
                const r = Cart.add(Number(add.dataset.chatAdd), 1, "");
                toast(r.ok ? "Added to your cart" : r.message, r.ok ? "ok" : "error", r.ok ? { href: link("cart.html"), text: "View cart" } : null);
            }
        });

        if (history.length === 0) welcome();
        else history.forEach((m) => draw(m.role === "user" ? "user" : "bot", m.text, m.ids));
    }

    function toggle() {
        const win = $("#chat-win");
        win.classList.toggle("is-open");
        if (win.classList.contains("is-open")) {
            const box = $("#chat-msgs");
            box.scrollTop = box.scrollHeight;
            $("#chat-input").focus();
        }
    }

    function welcome() {
        draw("bot", "Hi! I can help you find products, compare options or check delivery details. What are you looking for?");
        const chips = document.createElement("div");
        chips.className = "chat-chips";
        chips.innerHTML = ["Show me best sellers", "Something under NPR 2,000", "How much is delivery?", "Suggest a gift"].map((c) => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join("");
        $("#chat-msgs").appendChild(chips);
    }

    function draw(who, text, ids) {
        const box = $("#chat-msgs");
        const m = document.createElement("div");
        m.className = "msg " + who;
        m.textContent = text;
        box.appendChild(m);

        const products = (ids || []).map((id) => Catalog.byId(id)).filter(Boolean);
        if (products.length) {
            const cards = document.createElement("div");
            cards.className = "chat-cards";
            cards.innerHTML = products.map((p) => `<div class="chat-card"><img src="${esc(imgSrc(p.image))}" alt="">
                <div><strong>${esc(p.name)}</strong><div class="price"><b>${money(p.price)}</b>${p.comparePrice > p.price ? `<s>${money(p.comparePrice)}</s>` : ""}</div>
                <div class="row"><a href="${link("product.html")}?id=${p.id}">View</a>${p.sizes && p.sizes.length ? "" : `<button type="button" data-chat-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>Add to cart</button>`}</div></div></div>`).join("");
            box.appendChild(cards);
        }
        box.scrollTop = box.scrollHeight;
        return m;
    }

    async function send(text) {
        text = String(text || "").trim();
        if (!text || busy) return;
        busy = true;
        $("#chat-input").value = "";
        $("#chat-send").disabled = true;
        const chips = $(".chat-chips");
        if (chips) chips.remove();

        draw("user", text);
        const typing = document.createElement("div");
        typing.className = "msg bot";
        typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        $("#chat-msgs").appendChild(typing);
        $("#chat-msgs").scrollTop = 1e6;

        try {
            const res = await fetch(API + "/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, history: history.slice(-6).map((h) => ({ role: h.role, text: h.text })) })
            });
            const data = await res.json().catch(() => ({}));
            typing.remove();
            if (!res.ok || !data.success) throw new Error(data.message || "failed");
            history.push({ role: "user", text }, { role: "model", text: data.reply, ids: data.productIds });
            history = history.slice(-20);
            writeJSON(KEY, history);
            draw("bot", data.reply, data.productIds);
        } catch (e) {
            typing.remove();
            draw("bot", "Sorry, I couldn't answer that right now. Please try again in a moment.");
        } finally {
            busy = false;
            $("#chat-send").disabled = false;
            $("#chat-input").focus();
        }
    }

    // wait for the shared header/footer, then add the widget
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
    else build();
})();
