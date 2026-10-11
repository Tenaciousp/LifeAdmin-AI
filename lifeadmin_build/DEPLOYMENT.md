# LifeAdmin AI deployment guide

Status, 11 October 2026: release preparation only. Draft PR #2 is unmerged, the existing Render service retains maintenance mode and disabled automatic deployment, and live sales are not approved. Use [issue #3](https://github.com/Tenaciousp/LifeAdmin-AI/issues/3) for the current release gates. The promotional website is separate from the app and does not establish app readiness.

Publisher: Paul Lonergan trading as Tenaciouspl. Support: tenaciouspl@icloud.com. The purchased promotional domain is tenaciouspl.co.uk; do not use its origin as APP_BASE_URL unless the app is deliberately hosted there and its HTTPS origin has been verified.

## Recommended path

LifeAdmin AI now runs as a standard React/Vite frontend plus Python HTTP API. Replit is not required.

For development, use the built-in SQLite database. For a public service, use either a host with a persistent volume for SQLite or a managed PostgreSQL database.

## Single-container deployment

The included Dockerfile builds the React frontend and then starts the Python service, which serves both the SPA and `/api` routes.

Build from the `lifeadmin_build` directory with `docker build -t lifeadmin-ai .`. CI, local setup and the container use `npm ci` with the committed lockfile. Local dependency folders, build output, environment files and SQLite runtime data are excluded from the Docker build context. After an intentional dependency change, run `npm install` and commit the updated lockfile.

Production environment requirements:

- `APP_ENV=production`
- a strong `SESSION_SECRET`
- `APP_BASE_URL=https://your-domain.example`
- `ADMIN_EMAILS` containing only authorised administrator addresses
- persistent database storage

Optional integrations:

- `DATABASE_URL` for PostgreSQL
- OpenAI API credentials for live AI output. Deterministic playbooks remain available without them.
- Stripe sandbox credentials and the matching £1.99 GBP Complete-product Price ID for approved private payment testing. Live payment configuration requires separate approval.
- analytics identifiers after privacy/legal review

## Database

SQLite is suitable for local development, private testing and modest single-instance hosting when the database file lives on persistent storage. PostgreSQL is preferable when running multiple application instances or when the hosting platform does not guarantee a persistent local filesystem.

## Stripe launch checklist

Before turning on paid checkout:

1. Use one **LifeAdmin AI Complete** product, with all current planning features included. No separate Core purchase or All Access upgrade is part of this release.
2. Configure one active, one-time GBP Price at 199 pence using `STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP`. Checkout uses British pounds only. The backend verifies currency, amount, active status and one-time type before creating a session.
3. Set the webhook secret and point the Stripe webhook to `/api/stripe/webhook`.
4. Finish checkout success, failed/cancelled checkout, return verification, duplicate-webhook handling and persistent owner-scoped entitlement checks in Stripe sandbox mode. A successful purchase and a guest cancellation have been observed in the private sandbox; provider decline and replay evidence are still pending.
5. Confirm production terms, refund wording, support information and business identity.

Never treat the browser redirect alone as proof of payment. LifeAdmin AI verifies checkout status with the server and requires a paid session belonging to the current customer. Keep sandbox secret keys and webhook signing secrets in private runtime configuration. The webhook signing secret is separate from the API secret key.

The UK sandbox product and Price have been verified as active, one-time GBP 1.99. This is not evidence of live setup, tax compliance, refund processing or approval to accept customer payments. See [PAID_WEB_RELEASE.md](PAID_WEB_RELEASE.md) for the bounded evidence and remaining gates.

## AI configuration

The product works without an external model by using deterministic category and goal playbooks. If an AI provider is enabled, output is still normalised into the four fixed result sections before reaching the customer interface.

## Admin access

The admin dashboard is protected by signed-in account identity plus the `ADMIN_EMAILS` allowlist. Do not use a general customer account as an administrator unless its email is intentionally allowlisted.

## Analytics and advertising

Analytics requires explicit consent. Events are sanitised to avoid transmitting free-text provider messages, addresses, descriptions, notes or account details. Add GA4/Google Ads identifiers only after privacy disclosures and consent behaviour have been checked in the production jurisdiction.

Do not start paid acquisition until conversion events, purchase attribution, payment flow and product QA are verified end to end.

## Native stores

The current deliverable is a web application. Apple App Store and Google Play release work remains a separate phase requiring developer accounts, native packaging, in-app purchase implementation, signing, device QA, store assets and platform declarations.
