# LifeAdmin AI deployment guide

## Recommended path

LifeAdmin AI now runs as a standard React/Vite frontend plus Python HTTP API. Replit is not required.

For development, use the built-in SQLite database. For a public service, use either a host with a persistent volume for SQLite or a managed PostgreSQL database.

## Single-container deployment

The included Dockerfile builds the React frontend and then starts the Python service, which serves both the SPA and `/api` routes.

Production environment requirements:

- `APP_ENV=production`
- a strong `SESSION_SECRET`
- `APP_BASE_URL=https://your-domain.example`
- `ADMIN_EMAILS` containing only authorised administrator addresses
- persistent database storage

Optional integrations:

- `DATABASE_URL` for PostgreSQL
- OpenAI API credentials for live AI output. Deterministic playbooks remain available without them.
- Stripe credentials and both one-time price IDs for paid checkout
- analytics identifiers after privacy/legal review

## Database

SQLite is suitable for local development, private testing and modest single-instance hosting when the database file lives on persistent storage. PostgreSQL is preferable when running multiple application instances or when the hosting platform does not guarantee a persistent local filesystem.

## Stripe launch checklist

Before turning on paid checkout:

1. Create the Core and All Access one-time products in Stripe.
2. Configure the application price IDs.
3. Set the webhook secret and point the Stripe webhook to `/api/stripe/webhook`.
4. Verify checkout success, failed/cancelled checkout and webhook replay behaviour in Stripe test mode.
5. Confirm production terms, refund wording, support information and business identity.

Never treat the browser redirect alone as proof of payment. LifeAdmin AI verifies checkout status with the server.

## AI configuration

The product works without an external model by using deterministic category and goal playbooks. If an AI provider is enabled, output is still normalised into the four fixed result sections before reaching the customer interface.

## Admin access

The admin dashboard is protected by signed-in account identity plus the `ADMIN_EMAILS` allowlist. Do not use a general customer account as an administrator unless its email is intentionally allowlisted.

## Analytics and advertising

Analytics requires explicit consent. Events are sanitised to avoid transmitting free-text provider messages, addresses, descriptions, notes or account details. Add GA4/Google Ads identifiers only after privacy disclosures and consent behaviour have been checked in the production jurisdiction.

Do not start paid acquisition until conversion events, purchase attribution, payment flow and product QA are verified end to end.

## Native stores

The current deliverable is a web application. Apple App Store and Google Play release work remains a separate phase requiring developer accounts, native packaging, in-app purchase implementation, signing, device QA, store assets and platform declarations.
