/* Products page: search, filters, sort, load more */
(function () {
    const { $, $$, esc, money, App, Catalog, Settings, productCard, skeletons, icon } = SE;
    const PAGE = 12;

    const params = new URLSearchParams(location.search);
    const state = {
        cats: (params.get("category") || "").split(",").filter(Boolean),
        q: params.get("q") || "",
        min: params.get("min") || "",
        max: params.get("max") || "",
        rating: params.get("rating") || "",
        stock: params.get("stock") === "1",
        sale: params.get("sale") === "1",
        sort: params.get("sort") || "featured",
        shown: PAGE
    };

    function syncUrl() {
        const p = new URLSearchParams();
        if (state.cats.length) p.set("category", state.cats.join(","));
        if (state.q) p.set("q", state.q);
        if (state.min) p.set("min", state.min);
        if (state.max) p.set("max", state.max);
        if (state.rating) p.set("rating", state.rating);
        if (state.stock) p.set("stock", "1");
        if (state.sale) p.set("sale", "1");
        if (state.sort !== "featured") p.set("sort", state.sort);
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
    }

    function filtered(list) {
        let out = list.filter((p) => {
            if (state.cats.length && !state.cats.includes(p.category)) return false;
            if (state.q) {
                const hay = (p.name + " " + p.categoryName + " " + p.description).toLowerCase();
                if (!state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
            }
            if (state.min && p.price < Number(state.min)) return false;
            if (state.max && p.price > Number(state.max)) return false;
            if (state.rating && p.rating < Number(state.rating)) return false;
            if (state.stock && p.stock <= 0) return false;
            if (state.sale && !(p.comparePrice > p.price)) return false;
            return true;
        });
        const sorters = {
            featured: (a, b) => (b.sold - a.sold) || (a.id - b.id),
            new: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || b.id - a.id,
            "price-asc": (a, b) => a.price - b.price,
            "price-desc": (a, b) => b.price - a.price,
            rating: (a, b) => (b.rating - a.rating) || (b.reviews - a.reviews)
        };
        return out.sort(sorters[state.sort] || sorters.featured);
    }

    function renderFilters(list) {
        const cats = Settings.get().categories;
        $("#filters-body").innerHTML = `
            <div class="filter-block"><h4>Category</h4>
                ${cats.map((c) => `<label class="check"><input type="checkbox" data-cat="${esc(c.slug)}" ${state.cats.includes(c.slug) ? "checked" : ""}> ${esc(c.name)}<small>${list.filter((p) => p.category === c.slug).length}</small></label>`).join("")}
            </div>
            <div class="filter-block"><h4>Price (NPR)</h4>
                <div class="range-row"><input class="input" id="f-min" type="number" min="0" placeholder="Min" value="${esc(state.min)}"><span>–</span><input class="input" id="f-max" type="number" min="0" placeholder="Max" value="${esc(state.max)}"></div>
            </div>
            <div class="filter-block"><h4>Rating</h4>
                ${[["", "Any rating"], ["4", "4 stars and up"], ["3", "3 stars and up"]].map(([v, l]) => `<label class="check"><input type="radio" name="f-rating" value="${v}" ${state.rating === v ? "checked" : ""}> ${l}</label>`).join("")}
            </div>
            <div class="filter-block"><h4>Availability</h4>
                <label class="check"><input type="checkbox" id="f-stock" ${state.stock ? "checked" : ""}> In stock only</label>
                <label class="check"><input type="checkbox" id="f-sale" ${state.sale ? "checked" : ""}> On sale</label>
            </div>
            <button class="btn btn-outline btn-block" id="f-clear" type="button">Clear all filters</button>`;
    }

    function chips() {
        const cats = Settings.get().categories;
        const out = [];
        state.cats.forEach((s) => out.push([`cat:${s}`, (cats.find((c) => c.slug === s) || { name: s }).name]));
        if (state.q) out.push(["q", `"${state.q}"`]);
        if (state.min || state.max) out.push(["price", `${state.min ? money(state.min) : "Any"} – ${state.max ? money(state.max) : "Any"}`]);
        if (state.rating) out.push(["rating", `${state.rating}★ & up`]);
        if (state.stock) out.push(["stock", "In stock"]);
        if (state.sale) out.push(["sale", "On sale"]);
        $("#chips").innerHTML = out.map(([k, l]) => `<span class="chip">${esc(l)}<button type="button" data-chip="${esc(k)}" aria-label="Remove filter">${icon("x", "icon icon-sm")}</button></span>`).join("");
    }

    function render() {
        const list = Catalog.list;
        const items = filtered(list);
        const cats = Settings.get().categories;

        let title = "All products";
        if (state.sale && !state.cats.length && !state.q) title = "Sale";
        else if (state.cats.length === 1 && !state.q) title = (cats.find((c) => c.slug === state.cats[0]) || { name: "Products" }).name;
        else if (state.q) title = `Results for "${state.q}"`;
        $("#shop-title").textContent = title;
        document.title = `${title} | ${Settings.get().storeName}`;
        $("#shop-crumb").textContent = title;

        $("#count").textContent = `${items.length} ${items.length === 1 ? "product" : "products"}`;
        chips();

        const visible = items.slice(0, state.shown);
        $("#shop-grid").innerHTML = visible.length
            ? visible.map(productCard).join("")
            : `<div class="empty" style="grid-column:1/-1">${icon("search")}<h3>Nothing matched your search</h3><p>Try removing a filter or searching for something else.</p><button class="btn btn-primary" id="empty-clear" type="button">Clear filters</button></div>`;
        $("#load-more").hidden = items.length <= state.shown;
        $("#sort").value = state.sort;
        SE.Wishlist.paint();
    }

    function update(resetPage = true) {
        if (resetPage) state.shown = PAGE;
        syncUrl();
        render();
    }

    function bind() {
        const body = $("#filters-body");
        body.addEventListener("change", (e) => {
            const t = e.target;
            if (t.dataset.cat) {
                state.cats = t.checked ? [...new Set([...state.cats, t.dataset.cat])] : state.cats.filter((c) => c !== t.dataset.cat);
            } else if (t.name === "f-rating") state.rating = t.value;
            else if (t.id === "f-stock") state.stock = t.checked;
            else if (t.id === "f-sale") state.sale = t.checked;
            update();
        });
        body.addEventListener("input", SE.debounce((e) => {
            if (e.target.id === "f-min") { state.min = e.target.value; update(); }
            if (e.target.id === "f-max") { state.max = e.target.value; update(); }
        }, 350));
        body.addEventListener("click", (e) => e.target.id === "f-clear" && clearAll());

        $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
        $("#load-more button").addEventListener("click", () => { state.shown += PAGE; update(false); });
        $("#chips").addEventListener("click", (e) => {
            const b = e.target.closest("[data-chip]");
            if (!b) return;
            const k = b.dataset.chip;
            if (k.startsWith("cat:")) state.cats = state.cats.filter((c) => c !== k.slice(4));
            else if (k === "q") { state.q = ""; const q = $("#q"); if (q) q.value = ""; }
            else if (k === "price") { state.min = ""; state.max = ""; }
            else if (k === "rating") state.rating = "";
            else if (k === "stock") state.stock = false;
            else if (k === "sale") state.sale = false;
            renderFilters(Catalog.list);
            update();
        });
        $("#shop-grid").addEventListener("click", (e) => e.target.id === "empty-clear" && clearAll());

        const toggle = (open) => document.body.classList.toggle("filters-open", open);
        $("#open-filters").addEventListener("click", () => toggle(true));
        $("#close-filters").addEventListener("click", () => toggle(false));
        $("#drawer-backdrop").addEventListener("click", () => toggle(false));
    }

    function clearAll() {
        Object.assign(state, { cats: [], q: "", min: "", max: "", rating: "", stock: false, sale: false });
        const q = $("#q"); if (q) q.value = "";
        renderFilters(Catalog.list);
        update();
    }

    App.start(() => {
        $("#shop-grid").innerHTML = skeletons(6);
        bind();
        Catalog.subscribe((list) => { renderFilters(list); render(); });
        App.onSettings = () => { renderFilters(Catalog.list); render(); };
    });
})();
