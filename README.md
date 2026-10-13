# OpenPage

Direct-to-customer eBook store: React + Vite storefront and admin, Node/Express API, MongoDB, Razorpay payments, SMTP delivery.

```
Backend/    Express API, Mongoose models, services, background workers
Frontend/   React 19 + Vite + Tailwind storefront, customer account and admin dashboard
```

## Run locally

Requirements: Node 20+, MongoDB (local or Atlas).

```bash
# API
cd Backend
cp .env.example .env          # fill in values; generate secrets as described in the file
npm install
npm run seed -- --demo        # optional: 4 demo eBooks with placeholder PDFs
ADMIN_PASSWORD='choose-a-strong-one' npm run create-admin -- --email you@example.com --name "Your Name"
npm run dev                   # http://localhost:5000

# Storefront + admin
cd ../Frontend
npm install
npm run dev                   # http://localhost:5173  (proxies /api to :5000)
```

Admin dashboard: `/admin`. Admin access can only be granted with `npm run create-admin` on the server.

Without SMTP configured (development only), emails are not sent and checkout verification codes are printed to the API console. Without Razorpay keys, checkout stops before payment with a clear message.

## Configuration

* **Secrets and credentials** live only in `Backend/.env` (see `.env.example` for every variable). The server refuses to start if a required value is missing; Razorpay and SMTP are required when `NODE_ENV=production`.
* **Business settings** (homepage, SEO, offers, email templates, automations, tracking IDs, tax, download limits, feature toggles) are edited in the admin and stored in MongoDB.
* Optional `Frontend/.env`: `VITE_API_BASE_URL` (when the API is on another origin) and `VITE_SITE_URL` (canonical URLs).

### Razorpay
1. Put `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `.env`.
2. Create a webhook pointing to `{API_BASE_URL}/api/v1/webhooks/razorpay` with events `payment.captured`, `payment.failed`, `payment.authorized`, `order.paid`, `refund.processed`, `refund.failed`, and set `RAZORPAY_WEBHOOK_SECRET`.
3. Admin → Integrations shows key mode (test/live), webhook status and the last event received.

### Storage
`STORAGE_PROVIDER=cloudinary` (current setup) stores cover/preview images as public uploads and eBooks as authenticated raw files that are only fetched server-side through 60-second signed URLs; customers never see a Cloudinary link. Cloudinary's free plan caps raw files at 10 MB (`MAX_EBOOK_UPLOAD_MB=10`). `STORAGE_PROVIDER=local` keeps files under `Backend/storage` (development). For production use `s3` with any S3-compatible **private** bucket (AWS S3, Cloudflare R2, B2, Spaces). eBooks go under `private/`, images under `public/`. If you set `STORAGE_PUBLIC_ASSETS_BASE_URL`, it must map only to `public/`.

## Production deployment

* Serve the API and storefront from the same site (e.g. `shop.example.com` and `api.example.com`, or one domain with a reverse proxy) so the HTTP-only session cookies are first-party.
* Simplest setup: `npm run build` in `Frontend`, then set `SERVE_FRONTEND=true` on the API. The API then serves the app and injects per-page titles, descriptions, canonical URLs and JSON-LD into the HTML for crawlers, applies admin-managed 301 redirects, and returns real 404 status codes.
* Set `TRUST_PROXY` to the number of proxies in front of the API so rate limits see real client IPs.
* Background workers (email queue, webhooks, automations, campaigns, payment reconciliation) run inside the API process using a durable MongoDB queue; no Redis needed. On multiple instances, set `JOB_WORKERS_ENABLED=false` on all but one if you prefer a single worker (running several is also safe).
* Configure SPF, DKIM and DMARC for the sending domain.
* Have the seeded Terms, Privacy, Refund and Licensing pages reviewed by a lawyer for your jurisdictions (Admin → Legal pages).

## How the key flows work

* **Checkout:** the cart holds product IDs only; every price, discount and tax is recalculated on the server. The customer verifies their email with a 6-digit code (HMAC-hashed, bound to the checkout session and email, single use, rate limited) before a Razorpay order can be created. An earlier pending order for the same checkout is reconciled with Razorpay before any new payable order is created.
* **Payment:** an order becomes paid only when Razorpay confirms a captured payment of the exact amount and currency, via the signed checkout callback, the signed webhook, or reconciliation (which also runs automatically for stale pending orders). Duplicate and out-of-order events are handled idempotently.
* **Delivery:** paying creates purchase entitlements that snapshot the file version bought, and queues exactly one delivery email. Download links are random tokens (stored hashed), time-limited and use-limited, generated when the email is actually sent. Customers can request fresh links by email or from their library.
* **Refunds:** never automatic. Requests are reviewed, approved, and then explicitly initiated by an admin; gateway refund webhooks only update status.
* **Marketing:** automations and campaigns send marketing email only to opted-in, non-suppressed addresses, with one-click unsubscribe. Receipts and downloads are never affected. All automations ship disabled.
* **Tracking:** Meta Pixel, Google Ads and AdSense load only after consent. Purchase conversions fire once per order, after server-verified payment.

## Scripts (Backend)

| Command | Purpose |
|---|---|
| `npm run dev` | API with auto-reload |
| `npm start` | API (production) |
| `npm run seed [-- --demo]` | Default templates, automations, categories, legal pages (and demo eBooks) |
| `npm run create-admin -- --email … --name …` | Create or promote an administrator |
| `npm run check` | Load the full module graph to catch import errors |
