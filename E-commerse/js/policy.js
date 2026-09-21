/* Shipping / returns / privacy / terms pages.
   These are starter texts. Please review them and adjust to your business before going live. */
(function () {
    const { $, esc, money, App, Settings } = SE;

    function pages() {
        const s = Settings.get();
        const name = esc(s.storeName);
        const contact = s.email ? `email us at ${esc(s.email)}` : "use the contact page";
        return {
            shipping: {
                title: "Shipping and delivery",
                body: `
                <h2>Delivery charges</h2>
                <p>Delivery costs ${money(s.shippingFee)} per order${s.freeShippingThreshold > 0 ? `, and is free when your order total is ${money(s.freeShippingThreshold)} or more (after any coupon discount)` : ""}.</p>
                <h2>Processing and delivery time</h2>
                <p>Orders are confirmed and packed as soon as possible. Delivery times depend on your location and the seller. If your order contains items from different sellers, they may arrive separately.</p>
                <h2>Tracking your order</h2>
                <p>You can follow every step on the <a class="link" href="track.html">Track order</a> page using your order number and the email or phone number you used at checkout.</p>
                <h2>Payment</h2>
                <ul>${s.codEnabled ? "<li>Cash on delivery: pay the delivery person when your order arrives.</li>" : ""}${s.onlineEnabled ? "<li>eSewa, Khalti or bank transfer: send your payment and enter the transaction ID. We confirm it manually.</li>" : ""}</ul>`
            },
            returns: {
                title: "Returns and refunds",
                body: `
                <h2>7-day returns</h2>
                <p>If your item arrives damaged, defective or different from what you ordered, you can request a return within 7 days of delivery. Items must be unused and in their original packaging.</p>
                <h2>How to request a return</h2>
                <p>Please ${contact} with your order number and a few photos of the item. We will confirm the next steps within one working day.</p>
                <h2>Refunds</h2>
                <p>Once the returned item is received and checked, refunds are made using the payment method you originally used or by bank transfer for cash-on-delivery orders.</p>
                <h2>Cancelling an order</h2>
                <p>You can cancel an order yourself from My account while it is still in the "Order placed" stage. After it has been confirmed, please contact us.</p>`
            },
            privacy: {
                title: "Privacy policy",
                body: `
                <p>${name} respects your privacy. This page explains what information we collect and how we use it.</p>
                <h2>Information we collect</h2>
                <p>When you create an account or place an order we collect your name, email address, phone number and delivery address. If you write to us or leave a review, we keep that message too.</p>
                <h2>How we use it</h2>
                <ul><li>To process and deliver your orders and to contact you about them.</li><li>To let sellers on our platform fulfil the items you bought (they receive your name, phone and delivery address).</li><li>To answer your questions and improve our store.</li></ul>
                <h2>Sharing</h2>
                <p>We do not sell your personal information. We only share what is needed with sellers and delivery partners to complete your order.</p>
                <h2>Your choices</h2>
                <p>You can update your details from My account at any time. To ask us to delete your account or data, ${contact}.</p>`
            },
            terms: {
                title: "Terms of service",
                body: `
                <p>By using ${name} you agree to these terms.</p>
                <h2>Orders and prices</h2>
                <p>All prices are in Nepalese rupees (NPR). We may cancel an order if a product is out of stock or a price was shown incorrectly, and we will tell you if that happens.</p>
                <h2>Accounts</h2>
                <p>You are responsible for keeping your password safe and for the activity on your account. We may suspend accounts that are used to abuse the store.</p>
                <h2>Sellers</h2>
                <p>Products from third-party sellers are listed after approval. Sellers are responsible for the accuracy of their listings and for fulfilling orders on time.</p>
                <h2>Returns</h2>
                <p>Returns and refunds are handled as described on our Returns page.</p>
                <h2>Contact</h2>
                <p>Questions about these terms? Please ${contact}.</p>`
            }
        };
    }

    function render() {
        const key = new URLSearchParams(location.search).get("p") || "shipping";
        const all = pages();
        const page = all[key] || all.shipping;
        document.title = `${page.title} | ${Settings.get().storeName}`;
        $("#policy-title").textContent = page.title;
        $("#policy-crumb").textContent = page.title;
        $("#policy-body").innerHTML = page.body;
    }

    App.start(() => { render(); App.onSettings = render; });
})();
