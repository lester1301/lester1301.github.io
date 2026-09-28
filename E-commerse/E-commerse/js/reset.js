/* Reset password (landing page for the emailed link) */
(function () {
    const { $, App, api, toast, link } = SE;

    App.start(() => {
        const token = new URLSearchParams(location.search).get("token") || "";
        if (!token) {
            $("#reset-form").replaceWith(document.createRange().createContextualFragment(
                `<div class="alert alert-error">This reset link is missing its token. Please request a new one from the <a class="link" href="${link("login.html")}">sign in page</a>.</div>`
            ));
            return;
        }

        $("#reset-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const err = $("#reset-error");
            err.hidden = true;
            const p1 = $("#r-pass").value, p2 = $("#r-pass2").value;
            if (p1 !== p2) { err.textContent = "Passwords don't match."; err.hidden = false; return; }

            const btn = $("#reset-btn");
            btn.disabled = true;
            btn.textContent = "Please wait…";
            try {
                await api("/api/auth/reset", { method: "POST", auth: false, body: { token, password: p1 } });
                $("#reset-form").innerHTML = `<p style="color:var(--ok);font-weight:600">Your password has been reset.</p><a class="btn btn-primary btn-block" href="${link("login.html")}">Sign in</a>`;
            } catch (ex) {
                err.textContent = ex.message;
                err.hidden = false;
                btn.disabled = false;
                btn.textContent = "Reset password";
            }
        });
    });
})();
