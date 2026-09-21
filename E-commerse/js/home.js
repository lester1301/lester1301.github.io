/* Home page: hero slider, categories, product tabs, promo */
(function () {
    const { $, $$, esc, money, App, Catalog, Settings, productCard, skeletons, link, imgSrc, icon } = SE;

    /* ---------- hero slider ---------- */
    function hero() {
        const slides = $$(".hero-slide");
        const dotsHost = $("#hero-dots");
        if (!slides.length) return;
        let index = 0, timer = null;

        dotsHost.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Go to slide ${i + 1}"></button>`).join("");
        const dots = $$("button", dotsHost);

        const show = (i) => {
            index = (i + slides.length) % slides.length;
            slides.forEach((s, n) => { s.classList.toggle("is-active", n === index); s.setAttribute("aria-hidden", n !== index); });
            dots.forEach((d, n) => { d.classList.toggle("is-active", n === index); d.setAttribute("aria-current", n === index); });
        };
        const start = () => {
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            stop();
            timer = setInterval(() => show(index + 1), 6000);
        };
        const stop = () => clearInterval(timer);

        dots.forEach((d, i) => d.addEventListener("click", () => { show(i); start(); }));
        $("#hero-prev").addEventListener("click", () => { show(index - 1); start(); });
        $("#hero-next").addEventListener("click", () => { show(index + 1); start(); });
        const box = $(".hero");
        box.addEventListener("mouseenter", stop);
        box.addEventListener("mouseleave", start);
        box.addEventListener("focusin", stop);
        box.addEventListener("focusout", start);
        document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
        show(0);
        start();
    }

    /* ---------- trust strip ---------- */
    function trust() {
        const s = Settings.get();
        const items = [
            ["truck", "Fast delivery", s.freeShippingThreshold > 0 ? `Free on orders above ${money(s.freeShippingThreshold)}` : "Delivered to your door"],
            ["wallet", "Pay your way", [s.codEnabled ? "Cash on delivery" : "", s.onlineEnabled ? "eSewa / Khalti" : ""].filter(Boolean).join(" or ")],
            ["refresh", "Easy returns", "Return within 7 days"],
            ["chat", "Help when you need it", "Chat assistant and support"]
        ];
        $("#trust").innerHTML = `<div class="container">${items.map(([i, t, d]) => `<div class="trust-item">${icon(i)}<div><strong>${esc(t)}</strong><span>${esc(d)}</span></div></div>`).join("")}</div>`;
    }

    /* ---------- categories ---------- */
    function categories(list) {
        const cats = Settings.get().categories;
        $("#cat-grid").innerHTML = cats.map((c) => {
            const items = list.filter((p) => p.category === c.slug);
            const cover = items[0];
            return `<a class="cat-tile" href="${link("products.html")}?category=${encodeURIComponent(c.slug)}">
                ${cover ? `<img src="${esc(imgSrc(cover.image))}" alt="" loading="lazy">` : ""}
                <div><h3>${esc(c.name)}</h3><span>${items.length} ${items.length === 1 ? "product" : "products"}</span></div></a>`;
        }).join("");
    }

    /* ---------- product tabs ---------- */
    let tab = "trending";
    function tabs(list) {
        const sets = {
            trending: [...list].sort((a, b) => (b.sold - a.sold) || (a.id - b.id)),
            new: [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || b.id - a.id),
            sale: list.filter((p) => p.comparePrice > p.price)
        };
        const labels = { trending: "Trending", new: "New arrivals", sale: "On sale" };
        const available = Object.keys(sets).filter((k) => sets[k].length);
        if (!available.includes(tab)) tab = available[0] || "trending";

        $("#home-tabs").innerHTML = available.map((k) => `<button type="button" data-tab="${k}" class="${k === tab ? "is-active" : ""}">${labels[k]}</button>`).join("");
        const items = sets[tab].slice(0, 8);
        $("#home-products").innerHTML = items.length ? items.map(productCard).join("") : '<p class="muted">No products yet. Check back soon.</p>';
    }

    function promo(list) {
        const best = Math.max(0, ...list.map((p) => (p.comparePrice > p.price ? Math.round((1 - p.price / p.comparePrice) * 100) : 0)));
        const host = $("#promo");
        if (!best) { host.hidden = true; return; }
        host.hidden = false;
        $("#promo-title").textContent = `Save up to ${best}% on selected items`;
    }

    App.start(() => {
        hero();
        trust();
        $("#home-products").innerHTML = skeletons(8);
        Catalog.subscribe((list) => { categories(list); tabs(list); promo(list); });
        App.onSettings = () => { trust(); categories(Catalog.list); };
        $("#home-tabs").addEventListener("click", (e) => {
            const b = e.target.closest("[data-tab]");
            if (b) { tab = b.dataset.tab; tabs(Catalog.list); }
        });
    });
})();
