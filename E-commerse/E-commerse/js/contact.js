/* Contact page */
(function () {
    const { $, esc, App, Settings, api, icon, toast } = SE;

    function info() {
        const s = Settings.get();
        const rows = [];
        if (s.email) rows.push([`mail`, "Email", `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`]);
        if (s.phone) rows.push([`phone`, "Phone", `<a href="tel:${esc(s.phone.replace(/\s/g, ""))}">${esc(s.phone)}</a>`]);
        if (s.address) rows.push([`pin`, "Address", esc(s.address)]);
        rows.push(["clock", "Response time", "We usually reply within one working day."]);
        $("#contact-info").innerHTML = rows.map(([i, t, d]) => `<div>${icon(i)}<span><strong>${t}</strong>${d}</span></div>`).join("");
    }

    App.start(() => {
        info();
        App.onSettings = info;
        const form = $("#contact-form");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = $("#contact-btn"), err = $("#contact-error");
            err.hidden = true;
            btn.disabled = true;
            btn.textContent = "Sending…";
            try {
                const res = await api("/api/contact", {
                    method: "POST", auth: false,
                    body: { name: $("#c-name").value, email: $("#c-email").value, subject: $("#c-subject").value, message: $("#c-message").value }
                });
                form.innerHTML = `<div class="success" style="padding:10px 0"><div class="success-mark">${icon("check")}</div><h2>Message sent</h2><p class="muted">${esc(res.message)}</p></div>`;
            } catch (e2) {
                err.textContent = e2.message;
                err.hidden = false;
                btn.disabled = false;
                btn.textContent = "Send message";
            }
        });
    });
})();
