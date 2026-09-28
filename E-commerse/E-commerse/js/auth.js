/* Sign in / create account */
(function () {
    const { $, $$, App, Auth, Wishlist, api, link, esc } = SE;
    const params = new URLSearchParams(location.search);
    let mode = params.get("mode") === "seller" || params.get("mode") === "register" ? "register" : "login";

    function safeNext() {
        const n = params.get("next") || "";
        // only allow simple relative page names, never other sites
        return /^[a-zA-Z0-9_\-\/]+\.html(\?[^\s#]*)?(#[a-z]+)?$/.test(n) ? n : "";
    }

    function go(user) {
        const next = safeNext();
        if (next && (!user || user.role === "customer" || next.startsWith("product") || next.startsWith("checkout") || next.startsWith("cart"))) {
            location.href = link(next);
        } else location.href = Auth.homeFor(user);
    }

    function setMode(m) {
        mode = m;
        $$("[data-mode]").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === m));
        $("#login-form").hidden = m !== "login";
        $("#register-form").hidden = m !== "register";
        $("#auth-title").textContent = m === "login" ? "Welcome back" : "Create your account";
        $("#auth-sub").textContent = m === "login" ? "Sign in to see your orders and saved items." : "It only takes a minute.";
        $("#auth-error").hidden = true;
    }

    function fail(msg) {
        const el = $("#auth-error");
        el.textContent = msg;
        el.hidden = false;
    }

    async function submit(form, path, body, btn) {
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = "Please wait…";
        $("#auth-error").hidden = true;
        try {
            const res = await api(path, { method: "POST", body, auth: false });
            Auth.set(res.token, res.user);
            await Wishlist.sync();
            go(res.user);
        } catch (err) {
            fail(err.message);
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    async function submitLogin(e) {
        e.preventDefault();
        const btn = $("#login-btn");
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = "Please wait…";
        $("#auth-error").hidden = true;
        try {
            const res = await api("/api/auth/login", { method: "POST", auth: false, body: { email: $("#l-email").value, password: $("#l-password").value } });
            if (res.twoFactorRequired) return show2fa(res.tempToken);
            Auth.set(res.token, res.user);
            await Wishlist.sync();
            go(res.user);
        } catch (err) {
            fail(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    function show2fa(tempToken) {
        $("#login-form").hidden = true;
        $("#register-form").hidden = true;
        $(".auth-tabs").hidden = true;
        $("#auth-title").textContent = "Enter your code";
        $("#auth-sub").textContent = "Open your authenticator app and enter the 6-digit code.";
        $("#tfa-form").hidden = false;
        $("#tfa-code").focus();
        $("#tfa-form").dataset.token = tempToken;
    }

    function showForgot() {
        $("#login-form").hidden = true;
        $(".auth-tabs").hidden = true;
        $("#auth-title").textContent = "Reset your password";
        $("#auth-sub").textContent = "Enter your email and we'll send you a reset link.";
        $("#forgot-form").hidden = false;
    }

    function backToLogin() {
        $("#tfa-form").hidden = true;
        $("#forgot-form").hidden = true;
        $(".auth-tabs").hidden = false;
        setMode("login");
    }

    App.start(() => {
        if (Auth.isLoggedIn() && Auth.user()) return go(Auth.user());

        setMode(mode);
        if (params.get("mode") === "seller") { $("#f-seller").checked = true; sellerToggle(); }

        $$("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

        $("#login-form").addEventListener("submit", submitLogin);

        $("#tfa-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = $("#tfa-btn");
            btn.disabled = true;
            $("#auth-error").hidden = true;
            try {
                const res = await api("/api/auth/2fa/verify-login", { method: "POST", auth: false, body: { tempToken: e.target.dataset.token, code: $("#tfa-code").value } });
                Auth.set(res.token, res.user);
                await Wishlist.sync();
                go(res.user);
            } catch (err) { fail(err.message); btn.disabled = false; }
        });
        $("#tfa-back").addEventListener("click", backToLogin);

        $("#forgot-link").addEventListener("click", (e) => { e.preventDefault(); showForgot(); });
        $("#forgot-back").addEventListener("click", backToLogin);
        $("#forgot-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = $("#forgot-btn");
            btn.disabled = true;
            try {
                const res = await api("/api/auth/forgot", { method: "POST", auth: false, body: { email: $("#forgot-email").value, origin: location.origin + location.pathname.replace(/\/[^/]*$/, "") } });
                $("#forgot-form").innerHTML = `<p style="color:var(--ok);font-weight:600">${esc(res.message)}</p><button type="button" class="btn btn-outline btn-block" id="forgot-back2">Back to sign in</button>`;
                $("#forgot-back2").addEventListener("click", backToLogin);
            } catch (err) { fail(err.message); btn.disabled = false; }
        });

        $("#register-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const seller = $("#f-seller").checked;
            if ($("#r-password").value.length < 8) return fail("Password must be at least 8 characters.");
            submit(e.target, "/api/auth/register", {
                name: $("#r-name").value, email: $("#r-email").value, phone: $("#r-phone").value, password: $("#r-password").value,
                role: seller ? "seller" : "customer", shopName: $("#r-shop").value, shopDescription: $("#r-shopdesc").value
            }, $("#register-btn"));
        });

        $("#f-seller").addEventListener("change", sellerToggle);
    });

    function sellerToggle() {
        $("#seller-fields").hidden = !$("#f-seller").checked;
        $("#r-phone").required = $("#f-seller").checked;
        $("#r-shop").required = $("#f-seller").checked;
    }
})();
