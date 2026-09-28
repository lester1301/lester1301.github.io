# ShopEase — store, seller panel and admin panel

Frontend (HTML/CSS/JS) goes on **GitHub Pages**. Backend (`server/`) runs on **Render** (or any Node host).

```
E-commerse/
├─ index.html, products.html, product.html, cart.html, checkout.html, wishlist.html
├─ login.html, account.html (customer panel), track.html, contact.html, about.html, policy.html
├─ seller/index.html      → Seller panel
├─ admin/index.html       → Admin panel
├─ css/  js/  images/
└─ server/                → Node + Express API (auth, products, orders, coupons, uploads, AI chat)
```

## 1. Run it on your computer

```bash
cd server
npm install
cp .env.example .env        # then edit ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                 # website + API on http://localhost:3000
```

Open http://localhost:3000, sign in at `/login.html` with the admin email and password from `.env`.
If you don't set `ADMIN_PASSWORD`, a random one is printed in the terminal the first time the server starts.

Run the automatic tests any time: `npm test`

## 2. Put it online

**Backend (Render)**
1. Service root directory: `E-commerse/server` · Build: `npm install` · Start: `npm start`
2. Environment variables: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS=https://lester1301.github.io`
3. **Important — persistent storage.** Orders, users and uploaded product photos are saved in `DATA_DIR`.
   On Render's free plan the disk is wiped on every deploy/restart, so **everything would be lost**.
   Before you take real orders: use a paid instance with a **Disk** (mount at `/var/data`, set `DATA_DIR=/var/data`),
   or host on a VPS/Railway volume. (Later you can swap `server/lib/store.js` for MongoDB/Postgres.)

**Frontend (GitHub Pages)**
1. Replace the whole `E-commerse` folder in your repo with this one (delete the old files first, `js/app.js`, `hero-slider.js`, `wishlist-page.js` and the old images are no longer used).
2. In `js/config.js` make sure `API_BASE` is your Render URL.

## 3. First steps after launch (Admin panel → Settings)
- Set store name, phone, email, address, social links
- Set delivery charge and the free-delivery limit
- Add your eSewa / Khalti / bank details in "Payment instructions"
- Review the text on the Shipping, Returns, Privacy and Terms pages (`js/policy.js`) — they are starter drafts (7-day returns is written there; change it if your policy differs)
- Delete or edit the demo products (Products → Edit), and upload your own photos

## How the three panels work
- **Customer** (`account.html`): orders + tracking, cancel while "Order placed", addresses, profile, password, wishlist sync
- **Seller** (`seller/`): registers on `login.html?mode=seller` → admin approves → seller adds products (admin approves each product unless "auto-approve" is on) → sees only their own orders and marks them confirmed / shipped / delivered
- **Admin** (`admin/`): dashboard, all orders (confirm online payments, change status), all products (approve/reject), users (approve sellers, block, reset password), coupons, reviews, contact messages, settings and categories

## New in this version
- **Emails** (Resend or Brevo): order confirmation, forgot-password link, seller approved, back-in-stock code is NOT included (see below). Set `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `SITE_URL`. Without them, emails are only logged.
- **Forgot password**: `login.html` -> "Forgot your password?" -> emailed link -> `reset.html`.
- **eSewa + Khalti** automatic payment (test credentials built in). For real money set `ESEWA_MERCHANT_CODE`, `ESEWA_SECRET_KEY`, `ESEWA_GATEWAY_URL`, `KHALTI_SECRET_KEY`, `KHALTI_API_BASE` (see `.env.example`). Bank transfer stays manual.
- **Admin 2-step login** (Google Authenticator etc.): Admin > Settings > Two-factor authentication.
- **Returns and refunds**: customer requests within 7 days of delivery; Admin > Returns approves/rejects/marks refunded (stock is restored).
- **City-wise delivery charge**, **per-size stock**, **colour options**, **homepage banners**, **seller payouts**, **CSV export**, **backup/restore**: all in the Admin panel.
- **Cloudinary** image hosting (optional): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`.
- **Google Analytics**: paste your `G-...` ID in Admin > Settings > Analytics.
- **Nepali toggle (EN / ने)**: header, menu and common buttons only. Page content and panels stay English.

## Not built yet
- Email verification on signup and "back in stock" wishlist alerts (the email helper for it exists in `server/lib/email.js`, but nothing triggers it yet).
- Colour variants have no separate stock (stock is per size or per product).
- Real database (MongoDB/Postgres): data is still a JSON file, so keep a Render Disk and download backups regularly.
- Khalti/eSewa/email were tested with mocks only. Test them once after deploying.
- PDF invoice: use "Print invoice" and choose "Save as PDF" in the browser.

## Notes
- Prices are always recalculated on the server at checkout. The browser cannot change them.
- Online payment = customer pays by eSewa/Khalti/bank and enters the transaction ID; you mark the order Paid. Automatic gateway integration needs your merchant keys from eSewa/Khalti.
- There is no email sending yet (order emails, "forgot password"). Admin can reset a password from Users.
- Keep `server/.env` private. If a key was ever shared or uploaded, create a new one.
