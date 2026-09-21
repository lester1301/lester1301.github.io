/* =========================================================
   SHOPEASE CORE
   Shared by every storefront page:
   config, api, auth, settings, catalogue, cart, wishlist,
   header, footer, search, toasts and product cards.
========================================================= */
(function () {
    "use strict";

    const CFG = window.SHOPEASE_CONFIG || {};
    const isLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname);
    const API = (isLocal ? `${location.protocol}//${location.hostname || "localhost"}:3000` : CFG.API_BASE || "").replace(/\/$/, "");
    const ROOT = new URL("../", document.currentScript.src).href; // e.g. https://site/E-commerse/

    /* ---------------------------------------------------------
       HELPERS
    --------------------------------------------------------- */
    const $ = (sel, el = document) => el.querySelector(sel);
    const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    const money = (n) => "NPR " + Number(n || 0).toLocaleString("en-IN");
    const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const fmtDateTime = (iso) =>
        new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

    function debounce(fn, wait = 150) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }

    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }
    function writeJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full / blocked */ }
    }

    const STATUS = {
        pending: ["Order placed", "pill-warn"],
        confirmed: ["Confirmed", "pill-brand"],
        processing: ["In progress", "pill-brand"],
        shipped: ["Shipped", "pill-brand"],
        delivered: ["Delivered", "pill-ok"],
        cancelled: ["Cancelled", "pill-danger"]
    };
    const PAYMENT = {
        pending: ["Payment pending", "pill-warn"],
        paid: ["Paid", "pill-ok"],
        failed: ["Payment failed", "pill-danger"],
        refunded: ["Refunded", "pill"]
    };
    const statusPill = (s) => `<span class="pill ${(STATUS[s] || ["", "pill"])[1]}">${esc((STATUS[s] || [s])[0])}</span>`;
    const paymentPill = (s) => `<span class="pill ${(PAYMENT[s] || ["", "pill"])[1]}">${esc((PAYMENT[s] || [s])[0])}</span>`;

    /* ---------------------------------------------------------
       ICONS
    --------------------------------------------------------- */
    const ICONS = {
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
        bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        right: '<path d="m9 18 6-6-6-6"/>',
        left: '<path d="m15 18-6-6 6-6"/>',
        down: '<path d="m6 9 6 6 6-6"/>',
        star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/>',
        truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        refresh: '<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
        chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 3.9 11.5 8.5 8.5 0 0 1 12.4 3h.1a8.4 8.4 0 0 1 8.5 8.5z"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        minus: '<path d="M5 12h14"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        package: '<path d="m16.5 9.4-9-5.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
        tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
        filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
        mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
        phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
        pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
        send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11h18V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M9 20v-6h6v6"/>',
        receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8"/>',
        chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
        upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
        alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
        eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
        print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        card: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
        wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
    };

    function icon(name, cls = "icon") {
        return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
    }

    function stars(rating) {
        const full = Math.round(rating);
        let out = '<span class="stars" aria-hidden="true">';
        for (let i = 1; i <= 5; i++) {
            out += `<svg viewBox="0 0 24 24" fill="currentColor" class="${i <= full ? "" : "off"}">${ICONS.star}</svg>`;
        }
        return out + "</span>";
    }

    /* ---------------------------------------------------------
       TOAST / MODAL / BANNER
    --------------------------------------------------------- */
    function toast(message, type = "ok", link) {
        let box = $(".toasts");
        if (!box) {
            box = document.createElement("div");
            box.className = "toasts";
            box.setAttribute("role", "status");
            box.setAttribute("aria-live", "polite");
            document.body.appendChild(box);
        }
        const el = document.createElement("div");
        el.className = "toast " + (type === "error" ? "error" : "");
        el.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span>${esc(message)}</span>${link ? `<a href="${esc(link.href)}">${esc(link.text)}</a>` : ""}`;
        box.appendChild(el);
        setTimeout(() => el.remove(), 3800);
    }

    let bannerEl = null;
    function serverBanner(show) {
        if (show && !bannerEl) {
            bannerEl = document.createElement("div");
            bannerEl.className = "server-banner";
            bannerEl.textContent = "Connecting to the store server. The first visit can take up to a minute.";
            document.body.appendChild(bannerEl);
        } else if (!show && bannerEl) {
            bannerEl.remove();
            bannerEl = null;
        }
    }

    function modal({ title, body, footer, onClose }) {
        const wrap = document.createElement("div");
        wrap.className = "modal-backdrop";
        wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" style="color:var(--ink)" data-x aria-label="Close">${icon("x")}</button></div>
            <div class="modal-body"></div>${footer ? '<div class="modal-foot"></div>' : ""}</div>`;
        const body_ = $(".modal-body", wrap);
        if (typeof body === "string") body_.innerHTML = body;
        else if (body) body_.appendChild(body);
        if (footer) {
            const f = $(".modal-foot", wrap);
            if (typeof footer === "string") f.innerHTML = footer;
            else f.appendChild(footer);
        }
        const close = () => {
            wrap.remove();
            document.removeEventListener("keydown", onKey);
            if (onClose) onClose();
        };
        const onKey = (e) => e.key === "Escape" && close();
        wrap.addEventListener("click", (e) => (e.target === wrap || e.target.closest("[data-x]")) && close());
        document.addEventListener("keydown", onKey);
        document.body.appendChild(wrap);
        return { el: wrap, close };
    }

    /* ---------------------------------------------------------
       AUTH
    --------------------------------------------------------- */
    const Auth = {
        token: () => localStorage.getItem("se_token") || "",
        user: () => readJSON("se_user", null),
        isLoggedIn: () => !!localStorage.getItem("se_token"),
        set(token, user) {
            localStorage.setItem("se_token", token);
            writeJSON("se_user", user);
        },
        clear() {
            localStorage.removeItem("se_token");
            localStorage.removeItem("se_user");
        },
        async refresh() {
            if (!Auth.isLoggedIn()) return null;
            try {
                const data = await api("/api/auth/me");
                writeJSON("se_user", data.user);
                return data.user;
            } catch (e) {
                return null;
            }
        },
        logout() {
            Auth.clear();
            location.href = ROOT + "index.html";
        },
        homeFor(user) {
            if (user && user.role === "admin") return ROOT + "admin/index.html";
            if (user && user.role === "seller") return ROOT + "seller/index.html";
            return ROOT + "account.html";
        }
    };

    /* ---------------------------------------------------------
       API
    --------------------------------------------------------- */
    async function api(path, { method = "GET", body, auth = true } = {}) {
        const headers = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (auth && Auth.token()) headers.Authorization = "Bearer " + Auth.token();

        const slow = setTimeout(() => serverBanner(true), 4000);
        let res;
        try {
            res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
        } catch (e) {
            clearTimeout(slow);
            serverBanner(false);
            const err = new Error("Could not reach the server. Check your internet connection and try again.");
            err.network = true;
            throw err;
        }
        clearTimeout(slow);
        serverBanner(false);

        let data = null;
        try { data = await res.json(); } catch (e) { /* empty */ }
        if (!res.ok || (data && data.success === false)) {
            if (res.status === 401 && Auth.isLoggedIn()) Auth.clear();
            const err = new Error((data && data.message) || "Something went wrong. Please try again.");
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    /* ---------------------------------------------------------
       IMAGES
    --------------------------------------------------------- */
    function imgSrc(url) {
        if (!url) return ROOT + "images/products/product-1.jpg";
        if (/^(https?:|data:)/i.test(url)) return url;
        if (url.startsWith("/uploads/")) return API + url;
        return ROOT + url.replace(/^\//, "");
    }

    /* ---------------------------------------------------------
       SETTINGS
    --------------------------------------------------------- */
    const DEFAULT_SETTINGS = {
        storeName: "ShopEase",
        tagline: "Your everyday online shopping destination.",
        email: "", phone: "", address: "",
        shippingFee: 100, freeShippingThreshold: 3000,
        announcement: "", codEnabled: true, onlineEnabled: true, onlineInstructions: "",
        socials: { instagram: "", facebook: "", twitter: "" },
        categories: [
            { slug: "fashion", name: "Fashion" }, { slug: "shoes", name: "Shoes" },
            { slug: "electronics", name: "Electronics" }, { slug: "accessories", name: "Accessories" }
        ]
    };

    const Settings = {
        data: { ...DEFAULT_SETTINGS, ...readJSON("se_settings", {}) },
        listeners: [],
        get: () => Settings.data,
        onChange(fn) { Settings.listeners.push(fn); },
        async load() {
            try {
                const res = await api("/api/settings", { auth: false });
                const changed = JSON.stringify(res.settings) !== JSON.stringify(Settings.data);
                Settings.data = { ...DEFAULT_SETTINGS, ...res.settings };
                writeJSON("se_settings", Settings.data);
                if (changed) Settings.listeners.forEach((fn) => fn(Settings.data));
            } catch (e) { /* keep cached */ }
        }
    };

    /* ---------------------------------------------------------
       CATALOGUE  (cache first, then refresh from the server)
    --------------------------------------------------------- */
    const Catalog = {
        list: readJSON("se_catalog", null) || window.SEED_PRODUCTS || [],
        fresh: false,
        listeners: [],
        subscribe(fn) {
            Catalog.listeners.push(fn);
            fn(Catalog.list, false);
        },
        byId: (id) => Catalog.list.find((p) => p.id === Number(id)),
        categories: () => Settings.get().categories,
        async load() {
            try {
                const res = await api("/api/products", { auth: false });
                Catalog.list = res.products;
                Catalog.fresh = true;
                writeJSON("se_catalog", res.products);
                // remove cart lines for products that no longer exist
                Cart.prune();
                Catalog.listeners.forEach((fn) => fn(Catalog.list, true));
                Cart.emit();
            } catch (e) {
                /* offline / sleeping server: keep showing cached items */
            }
        }
    };

    /* badge shown on a product image (only one) */
    function productBadge(p) {
        if (p.stock <= 0) return '<span class="tag tag-dark">Sold out</span>';
        if (p.comparePrice > p.price) return `<span class="tag tag-sale">-${Math.round((1 - p.price / p.comparePrice) * 100)}%</span>`;
        if (p.badge) return `<span class="tag">${esc(p.badge)}</span>`;
        return "";
    }

    function productCard(p) {
        const on = Wishlist.has(p.id);
        const soldOut = p.stock <= 0;
        const needsSize = p.sizes && p.sizes.length;
        const action = soldOut
            ? '<button class="btn-add" disabled>Sold out</button>'
            : needsSize
                ? `<a class="btn-add" href="${ROOT}product.html?id=${p.id}" style="display:inline-grid;place-items:center">Choose size</a>`
                : `<button class="btn-add" data-add="${p.id}" type="button">Add to cart</button>`;
        return `<article class="pcard ${soldOut ? "is-soldout" : ""}">
            <a class="pcard-media" href="${ROOT}product.html?id=${p.id}" aria-label="${esc(p.name)}">
                <img src="${esc(imgSrc(p.image))}" alt="${esc(p.name)}" loading="lazy" width="400" height="400">
                <span class="pcard-badges">${productBadge(p)}</span>
            </a>
            <button class="wish-btn ${on ? "is-on" : ""}" data-wish="${p.id}" type="button" aria-pressed="${on}" aria-label="${on ? "Remove from wishlist" : "Add to wishlist"}">${icon("heart", "icon icon-sm")}</button>
            <div class="pcard-body">
                <span class="pcard-cat">${esc(p.categoryName)}</span>
                <a class="pcard-name" href="${ROOT}product.html?id=${p.id}">${esc(p.name)}</a>
                ${p.reviews > 0 ? `<span class="rating">${stars(p.rating)}<span>${p.rating.toFixed(1)} (${p.reviews})</span></span>` : ""}
                <div class="pcard-foot">
                    <div class="price"><b>${money(p.price)}</b>${p.comparePrice > p.price ? `<s>${money(p.comparePrice)}</s>` : ""}</div>
                    ${action}
                </div>
            </div>
        </article>`;
    }

    function skeletons(n = 4) {
        return Array.from({ length: n }, () => '<div class="skeleton card"></div>').join("");
    }

    /* ---------------------------------------------------------
       CART   [{ id, quantity, size }]
    --------------------------------------------------------- */
    const Cart = {
        read() {
            const list = readJSON("cart", []);
            return Array.isArray(list) ? list.filter((l) => l && l.id && l.quantity > 0).map((l) => ({ id: Number(l.id), quantity: Number(l.quantity), size: l.size || "" })) : [];
        },
        write(list) {
            writeJSON("cart", list);
            Cart.emit();
        },
        emit() {
            window.dispatchEvent(new CustomEvent("cart:change"));
        },
        prune() {
            if (!Catalog.list.length) return;
            const list = Cart.read();
            const kept = list.filter((l) => Catalog.byId(l.id));
            if (kept.length !== list.length) writeJSON("cart", kept);
        },
        /* returns { ok, message } */
        add(id, qty = 1, size = "") {
            const product = Catalog.byId(id);
            if (!product) return { ok: false, message: "This product is no longer available." };
            if (product.stock <= 0) return { ok: false, message: "This product is out of stock." };
            if (product.sizes && product.sizes.length && !product.sizes.includes(size)) return { ok: false, message: "Please choose a size first." };

            const list = Cart.read();
            const inCart = list.filter((l) => l.id === product.id).reduce((s, l) => s + l.quantity, 0);
            if (inCart + qty > product.stock) {
                return { ok: false, message: inCart >= product.stock ? "You already have all available stock in your cart." : `Only ${product.stock} available.` };
            }
            const line = list.find((l) => l.id === product.id && l.size === size);
            if (line) line.quantity += qty;
            else list.push({ id: product.id, quantity: qty, size });
            Cart.write(list);
            return { ok: true };
        },
        setQty(id, size, qty) {
            const list = Cart.read();
            const line = list.find((l) => l.id === id && l.size === size);
            if (!line) return;
            const product = Catalog.byId(id);
            const others = list.filter((l) => l !== line && l.id === id).reduce((s, l) => s + l.quantity, 0);
            const max = product ? Math.max(1, Math.min(20, product.stock - others)) : 20;
            line.quantity = Math.max(1, Math.min(max, qty));
            Cart.write(list);
        },
        remove(id, size) {
            Cart.write(Cart.read().filter((l) => !(l.id === id && l.size === size)));
        },
        clear() {
            Cart.write([]);
        },
        count: () => Cart.read().reduce((s, l) => s + l.quantity, 0),
        /* cart lines joined with live product data */
        lines() {
            return Cart.read()
                .map((l) => ({ ...l, product: Catalog.byId(l.id) }))
                .filter((l) => l.product);
        },
        subtotal: () => Cart.lines().reduce((s, l) => s + l.product.price * l.quantity, 0),
        coupon: () => readJSON("se_coupon", null),
        setCoupon(c) {
            if (c) writeJSON("se_coupon", c);
            else localStorage.removeItem("se_coupon");
        },
        /* Price breakdown for the current cart. Coupon is re-validated by the server. */
        async quote() {
            const subtotal = Cart.subtotal();
            const saved = Cart.coupon();
            let discount = 0, code = "", note = "", error = "";
            if (saved && saved.code && subtotal > 0) {
                try {
                    const r = await api("/api/coupons/validate", { method: "POST", body: { code: saved.code, subtotal }, auth: false });
                    discount = r.discount; code = r.code; note = r.description;
                    Cart.setCoupon({ code, discount, description: note });
                } catch (e) {
                    if (e.network) { discount = saved.discount || 0; code = saved.code; note = saved.description || ""; }
                    else { Cart.setCoupon(null); error = e.message; }
                }
            }
            const after = Math.max(0, subtotal - discount);
            const shipping = subtotal > 0 ? Cart.shippingFor(after) : 0;
            return { subtotal, discount, code, note, error, shipping, total: after + shipping };
        },
        shippingFor(afterDiscount) {
            const s = Settings.get();
            return s.freeShippingThreshold > 0 && afterDiscount >= s.freeShippingThreshold ? 0 : s.shippingFee;
        }
    };

    /* ---------------------------------------------------------
       WISHLIST  (local, synced to the account when signed in)
    --------------------------------------------------------- */
    const Wishlist = {
        ids: () => (readJSON("wishlist", []) || []).map(Number),
        has: (id) => Wishlist.ids().includes(Number(id)),
        save(ids) {
            writeJSON("wishlist", ids);
            window.dispatchEvent(new CustomEvent("wishlist:change"));
            if (Auth.isLoggedIn()) Wishlist.push();
        },
        toggle(id) {
            id = Number(id);
            const ids = Wishlist.ids();
            const i = ids.indexOf(id);
            if (i >= 0) ids.splice(i, 1);
            else ids.push(id);
            Wishlist.save(ids);
            return i < 0;
        },
        push: debounce(() => api("/api/account/wishlist", { method: "PUT", body: { wishlist: Wishlist.ids() } }).catch(() => {}), 500),
        async sync() {
            if (!Auth.isLoggedIn()) return;
            try {
                const res = await api("/api/account/wishlist");
                const merged = [...new Set([...(res.wishlist || []), ...Wishlist.ids()])];
                writeJSON("wishlist", merged);
                window.dispatchEvent(new CustomEvent("wishlist:change"));
                if (merged.length !== (res.wishlist || []).length) Wishlist.push();
            } catch (e) { /* ignore */ }
        },
        paint() {
            const ids = Wishlist.ids();
            $$("[data-wish]").forEach((b) => {
                const on = ids.includes(Number(b.dataset.wish));
                b.classList.toggle("is-on", on);
                b.setAttribute("aria-pressed", on);
                b.setAttribute("aria-label", on ? "Remove from wishlist" : "Add to wishlist");
            });
            $$(".js-wish-count").forEach((el) => {
                el.textContent = ids.length;
                el.dataset.zero = ids.length === 0;
            });
        }
    };

    /* ---------------------------------------------------------
       HEADER / FOOTER
    --------------------------------------------------------- */
    const page = () => document.body.dataset.page || "";
    const link = (file) => ROOT + file;

    function renderAnnounce() {
        const host = $("#site-announce");
        if (!host) return;
        const text = Settings.get().announcement;
        host.innerHTML = text ? `<div class="announce">${esc(text)}</div>` : "";
    }

    function renderNav() {
        const host = $("#site-nav");
        if (!host) return;
        const params = new URLSearchParams(location.search);
        const activeCat = page() === "products" ? params.get("category") : null;
        const sale = page() === "products" && params.get("sale");
        const all = page() === "products" && !activeCat && !sale;
        host.innerHTML = `<nav class="cat-nav" aria-label="Categories"><div class="container">
            <a href="${link("products.html")}" class="${all ? "is-active" : ""}">All products</a>
            ${Settings.get().categories.map((c) => `<a href="${link("products.html")}?category=${encodeURIComponent(c.slug)}" class="${activeCat === c.slug ? "is-active" : ""}">${esc(c.name)}</a>`).join("")}
            <a href="${link("products.html")}?sale=1" class="sale ${sale ? "is-active" : ""}">Sale</a>
            <span class="spacer"></span>
            <a href="${link("track.html")}" class="${page() === "track" ? "is-active" : ""}">Track order</a>
            <a href="${link("about.html")}" class="${page() === "about" ? "is-active" : ""}">About</a>
            <a href="${link("contact.html")}" class="${page() === "contact" ? "is-active" : ""}">Contact</a>
        </div></nav>`;

        const drawer = $("#drawer-links");
        if (drawer) {
            drawer.innerHTML = `<h4>Shop</h4>
                <a href="${link("products.html")}">All products</a>
                ${Settings.get().categories.map((c) => `<a href="${link("products.html")}?category=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`).join("")}
                <a href="${link("products.html")}?sale=1" style="color:var(--sale)">Sale</a>
                <h4>Help</h4>
                <a href="${link("track.html")}">Track order</a>
                <a href="${link("wishlist.html")}">Wishlist</a>
                <a href="${link("about.html")}">About us</a>
                <a href="${link("contact.html")}">Contact</a>`;
        }
    }

    function renderAccount() {
        const host = $("#hdr-account");
        if (!host) return;
        const user = Auth.user();
        const drawerAcc = $("#drawer-account");

        if (!user || !Auth.isLoggedIn()) {
            host.innerHTML = `<a class="hdr-account" href="${link("login.html")}">${icon("user")}<span>Sign in</span></a>`;
            if (drawerAcc) drawerAcc.innerHTML = `<a href="${link("login.html")}" class="btn btn-primary btn-block">Sign in or create account</a>`;
            return;
        }

        const first = esc(user.name.split(" ")[0]);
        const panel =
            user.role === "admin" ? `<a href="${link("admin/index.html")}">${icon("grid", "icon icon-sm")}Admin dashboard</a>`
            : user.role === "seller" ? `<a href="${link("seller/index.html")}">${icon("store", "icon icon-sm")}Seller dashboard</a>` : "";

        host.innerHTML = `<div class="dropdown">
            <button class="hdr-account" type="button" aria-haspopup="true" aria-expanded="false" id="acc-btn">${icon("user")}<span>${first}</span></button>
            <div class="dropdown-menu" id="acc-menu" hidden>
                <div class="dd-head"><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></div>
                ${panel}
                <a href="${link("account.html")}">${icon("user", "icon icon-sm")}My account</a>
                <a href="${link("account.html")}#orders">${icon("package", "icon icon-sm")}My orders</a>
                <a href="${link("wishlist.html")}">${icon("heart", "icon icon-sm")}Wishlist</a>
                <button type="button" id="logout-btn">${icon("logout", "icon icon-sm")}Sign out</button>
            </div></div>`;

        const btn = $("#acc-btn"), menu = $("#acc-menu");
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.hidden = !menu.hidden;
            btn.setAttribute("aria-expanded", !menu.hidden);
        });
        $("#logout-btn").addEventListener("click", Auth.logout);

        if (drawerAcc) {
            drawerAcc.innerHTML = `<div style="padding:4px 6px 10px"><strong style="color:var(--ink)">${esc(user.name)}</strong><br><small class="muted">${esc(user.email)}</small></div>
                ${user.role === "admin" ? `<a href="${link("admin/index.html")}">Admin dashboard</a>` : user.role === "seller" ? `<a href="${link("seller/index.html")}">Seller dashboard</a>` : ""}
                <a href="${link("account.html")}">My account</a><a href="${link("account.html")}#orders">My orders</a>
                <a href="#" id="drawer-logout">Sign out</a>`;
            $("#drawer-logout").addEventListener("click", (e) => { e.preventDefault(); Auth.logout(); });
        }
    }

    function renderFooter() {
        const host = $("#site-footer");
        if (!host) return;
        const s = Settings.get();
        const soc = s.socials || {};
        const socials = [["instagram", "IG"], ["facebook", "f"], ["twitter", "X"]]
            .filter(([k]) => soc[k])
            .map(([k, label]) => `<a href="${esc(soc[k])}" target="_blank" rel="noopener" aria-label="${k}">${label}</a>`).join("");

        host.innerHTML = `<footer class="site-footer"><div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <a href="${link("index.html")}" class="logo">${logoHTML(s.storeName)}</a>
                    <p>${esc(s.tagline)}</p>
                    ${socials ? `<div class="socials">${socials}</div>` : ""}
                </div>
                <div><h4>Shop</h4><ul>
                    ${s.categories.map((c) => `<li><a href="${link("products.html")}?category=${encodeURIComponent(c.slug)}">${esc(c.name)}</a></li>`).join("")}
                    <li><a href="${link("products.html")}?sale=1">Sale</a></li>
                </ul></div>
                <div><h4>Help</h4><ul>
                    <li><a href="${link("track.html")}">Track your order</a></li>
                    <li><a href="${link("policy.html")}?p=shipping">Shipping</a></li>
                    <li><a href="${link("policy.html")}?p=returns">Returns and refunds</a></li>
                    <li><a href="${link("contact.html")}">Contact us</a></li>
                    <li><a href="${link("policy.html")}?p=privacy">Privacy policy</a></li>
                    <li><a href="${link("policy.html")}?p=terms">Terms of service</a></li>
                </ul></div>
                <div><h4>Get in touch</h4><ul class="footer-contact">
                    ${s.email ? `<li>${icon("mail")}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>` : ""}
                    ${s.phone ? `<li>${icon("phone")}<a href="tel:${esc(s.phone.replace(/\s/g, ""))}">${esc(s.phone)}</a></li>` : ""}
                    ${s.address ? `<li>${icon("pin")}<span>${esc(s.address)}</span></li>` : ""}
                    <li>${icon("chat")}<a href="${link("contact.html")}">Send us a message</a></li>
                    <li>${icon("store")}<a href="${link("login.html")}?mode=seller">Sell on ${esc(s.storeName)}</a></li>
                </ul></div>
            </div>
            <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(s.storeName)}. All rights reserved.</span>
            <span>${[s.codEnabled ? "Cash on delivery" : "", s.onlineEnabled ? "eSewa, Khalti and bank transfer" : ""].filter(Boolean).join(" and ")}</span></div>
        </div></footer>`;
    }

    function logoHTML(name) {
        // "ShopEase" -> Shop<span>Ease</span>; any other name is shown plain with the last part accented
        const m = /^(.+?)([A-Z][a-z]+)$/.exec(name);
        return m ? `${esc(m[1])}<span>${esc(m[2])}</span>` : esc(name);
    }

    function renderCounts() {
        const n = Cart.count();
        $$(".js-cart-count").forEach((el) => {
            el.textContent = n;
            el.dataset.zero = n === 0;
        });
        Wishlist.paint();
    }

    function buildHeader() {
        const host = $("#site-header");
        if (!host) return;
        host.innerHTML = `<div id="site-announce"></div>
        <header class="site-header"><div class="container hdr-row">
            <button class="icon-btn hdr-menu-btn" id="open-drawer" type="button" aria-label="Open menu">${icon("menu")}</button>
            <a href="${link("index.html")}" class="logo" aria-label="Home">${logoHTML(Settings.get().storeName)}</a>
            <form class="hdr-search" id="hdr-search" role="search" autocomplete="off">
                <label class="sr-only" for="q">Search products</label>
                <input id="q" name="q" type="search" placeholder="Search for products" autocomplete="off">
                <button class="search-go" type="submit" aria-label="Search">${icon("search", "icon icon-sm")}</button>
                <div class="suggest" id="suggest" hidden></div>
            </form>
            <div class="hdr-actions">
                <div id="hdr-account"></div>
                <a class="icon-btn" href="${link("wishlist.html")}" aria-label="Wishlist">${icon("heart")}<span class="badge-count js-wish-count" data-zero="true">0</span></a>
                <a class="icon-btn" href="${link("cart.html")}" aria-label="Cart">${icon("bag")}<span class="badge-count js-cart-count" data-zero="true">0</span></a>
            </div>
        </div></header>
        <div id="site-nav"></div>
        <div class="drawer-backdrop" id="drawer-backdrop"></div>
        <aside class="drawer" aria-label="Menu">
            <div class="drawer-head"><a href="${link("index.html")}" class="logo">${logoHTML(Settings.get().storeName)}</a>
                <button class="icon-btn" id="close-drawer" style="color:#fff" aria-label="Close menu">${icon("x")}</button></div>
            <nav><div id="drawer-account" style="padding:8px 6px 0"></div><div id="drawer-links"></div></nav>
        </aside>`;

        const setDrawer = (open) => document.body.classList.toggle("drawer-open", open);
        $("#open-drawer").addEventListener("click", () => setDrawer(true));
        $("#close-drawer").addEventListener("click", () => setDrawer(false));
        $("#drawer-backdrop").addEventListener("click", () => setDrawer(false));

        setupSearch();
        renderAnnounce();
        renderNav();
        renderAccount();
        renderCounts();

        document.addEventListener("click", (e) => {
            const menu = $("#acc-menu");
            if (menu && !menu.hidden && !e.target.closest(".dropdown")) menu.hidden = true;
            const sg = $("#suggest");
            if (sg && !e.target.closest("#hdr-search")) sg.hidden = true;
        });
    }

    function setupSearch() {
        const form = $("#hdr-search"), input = $("#q"), box = $("#suggest");
        if (page() === "products") input.value = new URLSearchParams(location.search).get("q") || "";
        let focus = -1;

        const render = () => {
            const term = input.value.trim().toLowerCase();
            focus = -1;
            if (term.length < 2) { box.hidden = true; return; }
            const hits = Catalog.list
                .filter((p) => (p.name + " " + p.categoryName).toLowerCase().includes(term))
                .slice(0, 6);
            box.innerHTML = hits.length
                ? hits.map((p) => `<a href="${link("product.html")}?id=${p.id}"><img src="${esc(imgSrc(p.image))}" alt=""><span><strong>${esc(p.name)}</strong><small>${esc(p.categoryName)} · ${money(p.price)}</small></span></a>`).join("") +
                  `<a class="suggest-all" href="${link("products.html")}?q=${encodeURIComponent(input.value.trim())}">See all results</a>`
                : `<div class="suggest-empty">No products match "${esc(input.value.trim())}".</div>`;
            box.hidden = false;
        };
        input.addEventListener("input", debounce(render, 120));
        input.addEventListener("focus", render);
        input.addEventListener("keydown", (e) => {
            const items = $$("a", box);
            if (e.key === "Escape") { box.hidden = true; return; }
            if (!items.length || box.hidden) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                focus = (focus + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                items.forEach((a, i) => a.classList.toggle("is-focus", i === focus));
            } else if (e.key === "Enter" && focus >= 0) {
                e.preventDefault();
                location.href = items[focus].href;
            }
        });
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const q = input.value.trim();
            location.href = link("products.html") + (q ? "?q=" + encodeURIComponent(q) : "");
        });
    }

    /* ---------------------------------------------------------
       GLOBAL CLICK HANDLERS
    --------------------------------------------------------- */
    document.addEventListener("click", (e) => {
        const addBtn = e.target.closest("[data-add]");
        if (addBtn) {
            const res = Cart.add(Number(addBtn.dataset.add), 1, "");
            if (!res.ok) return toast(res.message, "error");
            const old = addBtn.textContent;
            addBtn.textContent = "Added";
            addBtn.classList.add("is-done");
            setTimeout(() => { addBtn.textContent = old; addBtn.classList.remove("is-done"); }, 1200);
            toast("Added to your cart", "ok", { href: link("cart.html"), text: "View cart" });
            return;
        }
        const wishBtn = e.target.closest("[data-wish]");
        if (wishBtn) {
            e.preventDefault();
            const on = Wishlist.toggle(wishBtn.dataset.wish);
            toast(on ? "Saved to your wishlist" : "Removed from your wishlist", "ok", on ? { href: link("wishlist.html"), text: "View" } : null);
        }
    });

    window.addEventListener("cart:change", renderCounts);
    window.addEventListener("wishlist:change", Wishlist.paint);
    window.addEventListener("storage", renderCounts);
    window.addEventListener("pageshow", (e) => e.persisted && renderCounts());

    /* ---------------------------------------------------------
       START
    --------------------------------------------------------- */
    const App = {
        /* runs fn once the header/footer exist. Data loads in the background. */
        start(fn) {
            const boot = () => {
                buildHeader();
                renderFooter();
                Settings.onChange(() => { renderAnnounce(); renderNav(); renderFooter(); if (App.onSettings) App.onSettings(); });
                Settings.load();
                Catalog.load();
                if (Auth.isLoggedIn()) {
                    Auth.refresh().then((u) => {
                        if (!Auth.isLoggedIn()) renderAccount();
                        else if (u) renderAccount();
                    });
                    Wishlist.sync();
                }
                if (fn) fn();
            };
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
            else boot();
        },
        /* send guests to the sign-in page */
        requireLogin(roles) {
            const user = Auth.user();
            if (!Auth.isLoggedIn() || !user || (roles && !roles.includes(user.role))) {
                location.replace(link("login.html") + "?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.hash));
                return false;
            }
            return true;
        },
        onSettings: null
    };

    window.SE = { API, ROOT, $, $$, esc, money, fmtDate, fmtDateTime, debounce, icon, stars, toast, modal, Auth, api, imgSrc, Settings, Catalog, Cart, Wishlist, App, productCard, productBadge, skeletons, statusPill, paymentPill, STATUS, PAYMENT, link, readJSON, writeJSON, logoHTML };
})();
