/* =========================================================
   PANEL CORE  (admin + seller dashboards)
   Shell, routing, tables, charts and the product editor.
========================================================= */
(function () {
    "use strict";
    const { $, $$, esc, money, icon, toast, modal, api, Auth, imgSrc, link, ROOT, fmtDate, fmtDateTime, statusPill, paymentPill } = SE;

    /* ---------- small helpers ---------- */
    const P = { views: {}, user: null, badges: {} };

    P.empty = (text) => `<div class="tbl-empty">${esc(text)}</div>`;

    P.table = (head, rows, emptyText) => {
        if (!rows.length) return `<div class="tbl-wrap">${P.empty(emptyText || "Nothing here yet.")}</div>`;
        return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map((h) => `<th class="${h.num ? "num" : ""}">${esc(h.label || h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
    };

    P.chart = (series, { prefix = "" } = {}) => {
        const W = 720, H = 230, padL = 46, padB = 28, padT = 12, padR = 8;
        const max = Math.max(...series.map((s) => s.amount), 1);
        const mag = Math.pow(10, Math.floor(Math.log10(max)));
        const top = ([1, 2, 4, 5, 6, 8, 10].map((n) => n * mag).find((n) => n >= max)) || max;
        const tick = (v) => (v >= 1000 ? +(v / 1000).toFixed(1) + "k" : Math.round(v));
        const bw = (W - padL - padR) / series.length;
        const y = (v) => padT + (H - padT - padB) * (1 - v / top);
        let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales over the last 14 days">`;
        for (let i = 0; i <= 2; i++) {
            const v = (top / 2) * i;
            out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${tick(v)}</text>`;
        }
        series.forEach((s, i) => {
            const h = Math.max(s.amount ? 3 : 0, (H - padT - padB) * (s.amount / top));
            const x = padL + i * bw + bw * 0.2;
            out += `<rect class="bar" x="${x}" y="${H - padB - h}" width="${bw * 0.6}" height="${h}" rx="4"><title>${esc(s.label)}: ${prefix}${money(s.amount)} (${s.orders} orders)</title></rect>`;
            if (i % 2 === 0) out += `<text x="${x + bw * 0.3}" y="${H - 8}" text-anchor="middle">${esc(s.label)}</text>`;
        });
        return out + "</svg>";
    };

    P.ordersTable = (orders, { showCustomer = true } = {}) =>
        P.table(["Order", "Date", showCustomer ? "Customer" : "", "Total", "Status"].filter(Boolean),
            orders.map((o) => `<tr><td><b style="color:var(--ink)">${esc(o.id)}</b></td><td>${fmtDate(o.createdAt)}</td>${showCustomer ? `<td>${esc(o.customer)}</td>` : ""}<td>${money(o.total)}</td><td>${statusPill(o.status)}</td></tr>`),
            "No orders yet.");

    /* ---------- image upload (resizes in the browser first) ---------- */
    function fileToJpeg(file, max = 1000) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const scale = Math.min(1, max / Math.max(img.width, img.height));
                const c = document.createElement("canvas");
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                resolve(c.toDataURL("image/jpeg", 0.86));
            };
            img.onerror = () => reject(new Error("That file could not be read as an image."));
            img.src = url;
        });
    }

    /* ---------- product editor (shared by admin and seller) ---------- */
    P.productForm = async function ({ product, base, categories, onSaved, isAdmin }) {
        const p = product || { name: "", category: categories[0] ? categories[0].slug : "", price: "", comparePrice: "", stock: "", description: "", features: [], images: [], sizes: [], badge: "", status: "active" };
        let images = [...(p.images || [])];

        const body = document.createElement("form");
        body.innerHTML = `<div class="form-grid">
            <div class="field full"><label>Product name</label><input class="input" name="name" maxlength="120" value="${esc(p.name)}" required></div>
            <div class="field"><label>Category</label><select class="select" name="category">${categories.map((c) => `<option value="${esc(c.slug)}" ${c.slug === p.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
            <div class="field"><label>Badge (optional)</label><input class="input" name="badge" maxlength="12" placeholder="e.g. NEW" value="${esc(p.badge)}"></div>
            <div class="field"><label>Selling price (NPR)</label><input class="input" name="price" type="number" min="1" value="${esc(p.price)}" required></div>
            <div class="field"><label>Original price (optional)</label><input class="input" name="comparePrice" type="number" min="0" value="${p.comparePrice ? esc(p.comparePrice) : ""}"><small>Shown crossed out to display a discount.</small></div>
            <div class="field"><label>Stock quantity</label><input class="input" name="stock" type="number" min="0" value="${esc(p.stock)}" required></div>
            <div class="field"><label>Sizes (optional)</label><input class="input" name="sizes" placeholder="S, M, L, XL" value="${esc((p.sizes || []).join(", "))}"><small>Separate with commas. Leave empty if not needed.</small></div>
            <div class="field full"><label>Description</label><textarea class="textarea" name="description" maxlength="4000" required>${esc(p.description)}</textarea></div>
            <div class="field full"><label>Key features (one per line)</label><textarea class="textarea" name="features" style="min-height:90px">${esc((p.features || []).join("\n"))}</textarea></div>
            <div class="field full"><label>Images</label><div class="img-list" id="pf-images"></div><small>First image is the main photo. Up to 6 images. JPG, PNG or WebP.</small>
                <input type="file" id="pf-file" accept="image/jpeg,image/png,image/webp" multiple hidden>
                <div style="display:flex;gap:8px;margin-top:6px"><input class="input" id="pf-url" placeholder="…or paste an image link (https://)" style="flex:1"><button class="btn btn-outline" type="button" id="pf-url-add">Add link</button></div></div>
            ${isAdmin || p.approved ? `<div class="field"><label>Visibility</label><select class="select" name="status"><option value="active" ${p.status !== "draft" ? "selected" : ""}>Live in store</option><option value="draft" ${p.status === "draft" ? "selected" : ""}>Draft (hidden)</option></select></div>` : ""}
            <div class="full field-error" id="pf-err"></div>
        </div>`;

        const foot = document.createElement("div");
        foot.innerHTML = `<button class="btn btn-outline" type="button" data-x>Cancel</button> <button class="btn btn-primary" type="button" id="pf-save">${product ? "Save changes" : "Add product"}</button>`;
        foot.style.cssText = "display:flex;gap:10px";
        const m = modal({ title: product ? "Edit product" : "Add product", body, footer: foot });
        m.el.querySelector(".modal").classList.add("wide");

        const paint = () => {
            $("#pf-images", m.el).innerHTML =
                images.map((u, i) => `<div class="img-item"><img src="${esc(imgSrc(u))}" alt="">${i === 0 ? '<span class="first">Main</span>' : ""}<button type="button" data-rm="${i}" aria-label="Remove image">${icon("x", "icon icon-sm")}</button></div>`).join("") +
                (images.length < 6 ? `<div class="img-add" id="pf-pick">${icon("upload")}<br>Upload</div>` : "");
        };
        paint();

        m.el.addEventListener("click", (e) => {
            const rm = e.target.closest("[data-rm]");
            if (rm) { images.splice(Number(rm.dataset.rm), 1); paint(); }
            if (e.target.closest("#pf-pick")) $("#pf-file", m.el).click();
        });
        $("#pf-url-add", m.el).addEventListener("click", () => {
            const v = $("#pf-url", m.el).value.trim();
            if (!/^https?:\/\//i.test(v)) return ($("#pf-err", m.el).textContent = "Image links must start with https://");
            if (images.length >= 6) return;
            images.push(v);
            $("#pf-url", m.el).value = "";
            $("#pf-err", m.el).textContent = "";
            paint();
        });
        $("#pf-file", m.el).addEventListener("change", async (e) => {
            const err = $("#pf-err", m.el);
            err.textContent = "";
            for (const file of [...e.target.files].slice(0, 6 - images.length)) {
                try {
                    err.textContent = "Uploading…";
                    const data = await fileToJpeg(file);
                    const r = await api("/api/upload", { method: "POST", body: { data } });
                    images.push(r.url);
                    paint();
                    err.textContent = "";
                } catch (ex) { err.textContent = ex.message; }
            }
            e.target.value = "";
        });

        $("#pf-save", m.el).addEventListener("click", async () => {
            const f = new FormData(body);
            const payload = {
                name: f.get("name"), category: f.get("category"), badge: f.get("badge"), price: f.get("price"), comparePrice: f.get("comparePrice"),
                stock: f.get("stock"), sizes: f.get("sizes"), description: f.get("description"), features: f.get("features"), images, status: f.get("status") || undefined
            };
            const btn = $("#pf-save", m.el);
            btn.disabled = true;
            try {
                const r = await api(product ? `${base}/${product.id}` : base, { method: product ? "PUT" : "POST", body: payload });
                m.close();
                toast(r.message || "Saved");
                onSaved && onSaved(r.product);
            } catch (ex) {
                $("#pf-err", m.el).textContent = ex.message;
                btn.disabled = false;
            }
        });
    };

    P.productStatusPill = (p) => {
        if (p.status === "active" && p.approved) return '<span class="pill pill-ok">Live</span>';
        if (p.status === "pending") return '<span class="pill pill-warn">Awaiting approval</span>';
        if (p.status === "rejected") return '<span class="pill pill-danger" title="' + esc(p.rejectReason) + '">Rejected</span>';
        if (p.status === "draft") return '<span class="pill">Draft</span>';
        return '<span class="pill">Archived</span>';
    };

    /* ---------- shell + router ---------- */
    P.mount = function ({ role, title, nav, views, home }) {
        const user = Auth.user();
        if (!Auth.isLoggedIn() || !user) {
            location.replace(ROOT + "login.html?next=" + encodeURIComponent(role + "/index.html"));
            return;
        }
        if (user.role !== role) {
            location.replace(Auth.homeFor(user));
            return;
        }
        P.user = user;
        P.views = views;

        document.body.classList.add("panel-body");
        document.body.innerHTML = `
        <div class="panel">
            <aside class="side">
                <div class="side-brand"><a href="${ROOT}index.html" class="logo">${SE.logoHTML("ShopEase")}</a><span class="role-tag">${esc(title)}</span></div>
                <nav id="p-nav" aria-label="Sections">${nav.map((n) => `<a href="#/${n.key}" data-key="${n.key}">${icon(n.icon)}<span>${esc(n.label)}</span><span class="nav-badge" data-badge="${n.key}" hidden></span></a>`).join("")}</nav>
                <div class="side-foot">
                    <a href="${ROOT}index.html">${icon("home")}View store</a>
                    <a href="${ROOT}account.html">${icon("user")}My account</a>
                    <button type="button" id="p-logout">${icon("logout")}Sign out</button>
                </div>
            </aside>
            <div class="p-main">
                <header class="topbar">
                    <button class="icon-btn menu-btn" id="p-menu" type="button" aria-label="Open menu">${icon("menu")}</button>
                    <strong id="p-title" style="color:var(--ink);font-size:16px"></strong>
                    <div class="who"><span>${esc(user.name)}</span><div class="avatar">${esc(user.name.charAt(0).toUpperCase())}</div></div>
                </header>
                <main class="content" id="view"></main>
            </div>
        </div>`;

        $("#p-logout").addEventListener("click", Auth.logout);
        $("#p-menu").addEventListener("click", () => document.body.classList.toggle("side-open"));
        document.addEventListener("click", (e) => {
            if (document.body.classList.contains("side-open") && !e.target.closest(".side") && !e.target.closest("#p-menu")) document.body.classList.remove("side-open");
            if (e.target.closest(".side nav a")) document.body.classList.remove("side-open");
        });

        const route = async () => {
            const key = (location.hash.replace(/^#\/?/, "") || home).split("?")[0];
            const def = nav.find((n) => n.key === key) || nav.find((n) => n.key === home);
            $$("#p-nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.key === def.key));
            $("#p-title").textContent = def.label;
            document.title = `${def.label} | ${title}`;
            const host = $("#view");
            host.innerHTML = '<div class="skeleton" style="height:180px"></div>';
            try { await views[def.key](host); }
            catch (e) {
                host.innerHTML = `<div class="box"><div class="alert alert-error">${esc(e.message)}</div><p style="margin-top:14px"><button class="btn btn-outline" onclick="location.reload()">Try again</button></p></div>`;
                if (e.status === 401) location.replace(ROOT + "login.html");
            }
            window.scrollTo(0, 0);
        };
        P.reload = route;
        window.addEventListener("hashchange", route);
        route();

        // keep the role fresh (e.g. seller approval)
        Auth.refresh().then((u) => {
            if (!Auth.isLoggedIn() || !u) return location.replace(ROOT + "login.html");
            if (u.role !== role) return location.replace(Auth.homeFor(u));
            const changed = u.status !== P.user.status;
            P.user = u;
            if (changed) route();
        });
    };

    P.setBadge = (key, n) => {
        const el = $(`[data-badge="${key}"]`);
        if (!el) return;
        el.textContent = n;
        el.hidden = !n;
    };

    P.head = (title, sub, actions = "") => `<div class="p-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div><div>${actions}</div></div>`;

    P.printModal = () => {
        document.body.classList.add("printing-modal");
        window.print();
        setTimeout(() => document.body.classList.remove("printing-modal"), 500);
    };

    window.P = P;
})();
