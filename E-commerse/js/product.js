/* Product detail page */
(function () {
    const { $, $$, esc, money, App, Catalog, Cart, Wishlist, Auth, Settings, api, toast, icon, stars, imgSrc, productCard, productBadge, link, fmtDate } = SE;

    const id = Number(new URLSearchParams(location.search).get("id"));
    let product = null, size = "", qty = 1, gallery = 0, tab = "description", reviews = [];

    function notFound() {
        $("#pd-root").innerHTML = `<div class="empty">${icon("search")}<h2>Product not found</h2><p>This product may have been removed or is no longer available.</p><a class="btn btn-primary" href="${link("products.html")}">Browse products</a></div>`;
        $("#pd-extra").innerHTML = "";
    }

    function stockNote(p) {
        if (p.stock <= 0) return `<div class="stock-note out">${icon("x", "icon icon-sm")}Out of stock</div>`;
        if (p.stock <= 5) return `<div class="stock-note low">${icon("clock", "icon icon-sm")}Only ${p.stock} left, order soon</div>`;
        return `<div class="stock-note ok">${icon("check", "icon icon-sm")}In stock</div>`;
    }

    function render() {
        const p = product;
        const s = Settings.get();
        const imgs = p.images && p.images.length ? p.images : [p.image];
        const on = Wishlist.has(p.id);
        const discount = p.comparePrice > p.price ? Math.round((1 - p.price / p.comparePrice) * 100) : 0;
        const max = Math.max(1, Math.min(10, p.stock));
        qty = Math.min(qty, max);

        document.title = `${p.name} | ${s.storeName}`;
        $("#crumb-cat").innerHTML = `<a href="${link("products.html")}?category=${encodeURIComponent(p.category)}">${esc(p.categoryName)}</a>`;
        $("#crumb-name").textContent = p.name;

        $("#pd-root").innerHTML = `
        <div class="gallery">
            <div class="gallery-thumbs">${imgs.map((u, i) => `<button type="button" data-thumb="${i}" class="${i === gallery ? "is-active" : ""}" aria-label="Image ${i + 1}"><img src="${esc(imgSrc(u))}" alt=""></button>`).join("")}</div>
            <div class="gallery-main"><img id="main-img" src="${esc(imgSrc(imgs[gallery]))}" alt="${esc(p.name)}"><span class="pcard-badges" style="left:14px;top:14px">${productBadge(p)}</span></div>
        </div>
        <div class="pd-info">
            <div><span class="muted">${esc(p.categoryName)}</span><h1>${esc(p.name)}</h1></div>
            <div class="pd-meta">
                ${p.reviews > 0 ? `<a href="#reviews" data-goto-reviews style="display:inline-flex;align-items:center;gap:8px">${stars(p.rating)}<span>${p.rating.toFixed(1)} (${p.reviews} ${p.reviews === 1 ? "review" : "reviews"})</span></a>` : `<a href="#reviews" data-goto-reviews class="link">Be the first to review</a>`}
                <span>Sold by ${esc(p.seller || s.storeName)}</span>
            </div>
            <div class="pd-price"><b>${money(p.price)}</b>${discount ? `<s>${money(p.comparePrice)}</s><span class="tag tag-sale">Save ${discount}%</span>` : ""}</div>
            <p class="pd-desc">${esc((p.description || "").split("\n")[0])}</p>
            <div class="divider"></div>
            ${p.sizes && p.sizes.length ? `<div><div class="opt-label"><span>Size</span><span id="size-msg" class="text-sale" style="font-weight:600"></span></div><div class="size-list">${p.sizes.map((z) => `<button type="button" data-size="${esc(z)}" class="${z === size ? "is-active" : ""}">${esc(z)}</button>`).join("")}</div></div>` : ""}
            ${stockNote(p)}
            <div class="pd-actions">
                <div class="qty" ${p.stock <= 0 ? 'hidden' : ""}><button type="button" data-qty="-1" aria-label="Decrease quantity">${icon("minus", "icon icon-sm")}</button><span id="qty">${qty}</span><button type="button" data-qty="1" aria-label="Increase quantity">${icon("plus", "icon icon-sm")}</button></div>
                <button class="btn btn-primary btn-lg" id="add-cart" type="button" ${p.stock <= 0 ? "disabled" : ""}>${p.stock <= 0 ? "Sold out" : "Add to cart"}</button>
                <button class="wish-inline ${on ? "is-on" : ""}" data-wish="${p.id}" type="button" aria-label="Save to wishlist">${icon("heart")}</button>
            </div>
            ${p.stock > 0 ? '<button class="btn btn-dark btn-block" id="buy-now" type="button">Buy it now</button>' : ""}
            <div class="perks">
                <div>${icon("truck")}<span>${s.freeShippingThreshold > 0 ? `Delivery ${money(s.shippingFee)}, free above ${money(s.freeShippingThreshold)}` : `Delivery ${money(s.shippingFee)}`}</span></div>
                <div>${icon("wallet")}<span>${[s.codEnabled ? "Cash on delivery" : "", s.onlineEnabled ? "eSewa, Khalti or bank transfer" : ""].filter(Boolean).join(" · ")}</span></div>
                <div>${icon("refresh")}<span>7-day easy returns</span></div>
            </div>
        </div>`;
        Wishlist.paint();
        renderTabs();
        renderRelated();
    }

    function renderTabs() {
        const p = product;
        const feats = (p.features || []).length ? `<ul class="dots" style="margin-top:18px">${p.features.map((f) => `<li>${icon("check")}<span>${esc(f)}</span></li>`).join("")}</ul>` : "";
        const desc = `<p style="white-space:pre-line">${esc(p.description)}</p>${feats}`;

        const list = reviews.length
            ? reviews.map((r) => `<div class="review"><div class="review-head">${stars(r.rating)}<strong style="color:var(--ink)">${esc(r.name)}</strong>${r.verified ? '<span class="pill pill-ok">Verified purchase</span>' : ""}<span class="muted" style="font-size:13px">${fmtDate(r.createdAt)}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ""}</div>`).join("")
            : '<p class="muted">No reviews yet. Bought this? Tell others what you think.</p>';

        const form = Auth.isLoggedIn()
            ? `<form class="review-form" id="review-form"><strong style="color:var(--ink)">Write a review</strong>
                <div class="star-input" id="star-input">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} stars">${icon("star")}</button>`).join("")}</div>
                <textarea class="textarea" id="review-text" maxlength="1000" placeholder="Share your experience (optional)"></textarea>
                <div id="review-err" class="field-error"></div>
                <button class="btn btn-dark" type="submit" style="justify-self:start">Submit review</button></form>`
            : `<div class="review-form"><span>Please <a class="link" href="${link("login.html")}?next=${encodeURIComponent("product.html?id=" + id)}">sign in</a> to write a review.</span></div>`;

        $("#pd-tabs").innerHTML = `
            <div class="tab-list" role="tablist"><button type="button" data-tab="description" class="${tab === "description" ? "is-active" : ""}">Description</button>
            <button type="button" data-tab="reviews" id="reviews" class="${tab === "reviews" ? "is-active" : ""}">Reviews (${reviews.length})</button></div>
            <div class="tab-panel">${tab === "description" ? desc : list + form}</div>`;
        rating = 0;
    }

    function renderRelated() {
        const p = product;
        let items = Catalog.list.filter((x) => x.id !== p.id && x.category === p.category);
        if (items.length < 4) items = items.concat(Catalog.list.filter((x) => x.id !== p.id && x.category !== p.category));
        items = items.slice(0, 4);
        $("#pd-extra").innerHTML = items.length ? `<section class="section tint"><div class="container"><div class="section-head"><h2>You may also like</h2></div><div class="product-grid">${items.map(productCard).join("")}</div></div></section>` : "";
        Wishlist.paint();
    }

    let rating = 0;

    function bind() {
        document.addEventListener("click", async (e) => {
            if (!product) return;
            const t = e.target;
            const thumb = t.closest("[data-thumb]");
            if (thumb) { gallery = Number(thumb.dataset.thumb); render(); return; }
            const sz = t.closest("[data-size]");
            if (sz) { size = sz.dataset.size; $$("[data-size]").forEach((b) => b.classList.toggle("is-active", b.dataset.size === size)); $("#size-msg").textContent = ""; return; }
            const q = t.closest("[data-qty]");
            if (q) {
                const max = Math.max(1, Math.min(10, product.stock));
                qty = Math.max(1, Math.min(max, qty + Number(q.dataset.qty)));
                $("#qty").textContent = qty;
                return;
            }
            if (t.closest("[data-goto-reviews]")) { e.preventDefault(); tab = "reviews"; renderTabs(); $("#pd-tabs").scrollIntoView({ behavior: "smooth" }); return; }
            const tb = t.closest("[data-tab]");
            if (tb && tb.closest("#pd-tabs")) { tab = tb.dataset.tab; renderTabs(); return; }
            const star = t.closest("[data-star]");
            if (star) { rating = Number(star.dataset.star); $$("#star-input button").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.star) <= rating)); return; }

            if (t.closest("#add-cart") || t.closest("#buy-now")) {
                if (product.sizes.length && !size) {
                    $("#size-msg").textContent = "Please choose a size";
                    toast("Please choose a size first", "error");
                    return;
                }
                const res = Cart.add(product.id, qty, size);
                if (!res.ok) return toast(res.message, "error");
                if (t.closest("#buy-now")) location.href = link("checkout.html");
                else toast("Added to your cart", "ok", { href: link("cart.html"), text: "View cart" });
            }
        });

        document.addEventListener("submit", async (e) => {
            if (e.target.id !== "review-form") return;
            e.preventDefault();
            if (!rating) { $("#review-err").textContent = "Please choose a star rating."; return; }
            try {
                await api(`/api/products/${product.id}/reviews`, { method: "POST", body: { rating, comment: $("#review-text").value } });
                toast("Thanks for your review!");
                await loadReviews();
                Catalog.load();
            } catch (err) {
                $("#review-err").textContent = err.message;
            }
        });
    }

    async function loadReviews() {
        try {
            reviews = (await api(`/api/products/${id}/reviews`, { auth: false })).reviews;
            if (product) renderTabs();
        } catch (e) { /* keep empty */ }
    }

    function refresh(fresh) {
        const found = Catalog.byId(id);
        if (found) { product = found; render(); }
        else if (fresh) notFound();
    }

    App.start(() => {
        if (!id) return notFound();
        bind();
        $("#pd-root").innerHTML = '<div class="skeleton" style="aspect-ratio:1;grid-column:1/-1;max-width:520px"></div>';
        Catalog.subscribe((list, fresh) => {
            // do not rebuild the page while the visitor is mid-interaction with fresh data of the same product
            if (product && fresh && JSON.stringify(Catalog.byId(id)) === JSON.stringify(product)) return;
            refresh(fresh);
        });
        loadReviews();
        window.addEventListener("wishlist:change", Wishlist.paint);
    });
})();
