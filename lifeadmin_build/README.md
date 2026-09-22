# LifeAdmin AI

LifeAdmin AI is a privacy-light household-admin assistant for bills, renewals, subscriptions and recurring payments.

**Promise:** Sort bills, renewals and subscriptions without the admin headache.

Customers search for or choose a household bill, select a goal, add only what they know, review useful missing details, and generate four reliable sections:

1. Next steps
2. Provider message
3. Things to check
4. Approval checklist

The product includes 12 household categories, seven action-based goals, smart routing, dynamic forms, a dedicated unknown-payment journey, saved plans, manual AI handoff, account controls, a protected admin dashboard and one-time pricing.

## Privacy model

- No bank connection required
- No mailbox access required
- No automatic provider contact
- No automatic sharing with another AI service
- Guest work is isolated with a signed browser cookie
- Signed-in data is separated by account
- Analytics is opt-in and excludes bill text, provider messages, addresses and account details
- Account deletion removes account-linked records

## Pricing

- **Core:** £0.99 / $0.99 one time
- **All Access:** an additional £1.99 / $1.99 one time
- No subscription

Equivalent local store tiers can be used later for native stores.

## Run locally without Replit

Requirements: Python 3.11+ and Node.js 20+.

```text
npm install
npm run dev:api
npm run dev:web
```

The web app runs with Vite and proxies API calls to the Python service. SQLite is used automatically when no PostgreSQL database is configured.

For a production-style single-server build:

```text
npm install
npm run build:web
npm start
```

The Python service then serves the built React application and API from one process.

## Storage

Development needs no external database. LifeAdmin AI uses SQLite by default. Set `DATABASE_URL` to a PostgreSQL URL for a managed production database. PostgreSQL support is optional and requires the package listed in `requirements.txt`.

## Production configuration

Copy `.env.example` and configure only the services you intend to use. Important production values include:

- `SESSION_SECRET`
- `APP_BASE_URL`
- `DATABASE_URL` for PostgreSQL, if used
- `OPENAI_API_KEY` and optional `OPENAI_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe Core and All Access price IDs
- `ADMIN_EMAILS`

Never commit live credentials.

## Payments

Stripe is optional during development. The interface remains in preview mode until both one-time products and Stripe credentials are configured. Checkout success is verified with the backend before an entitlement is shown as unlocked.

## Analytics and ads readiness

Analytics is disabled until a visitor explicitly opts in. The event layer supports privacy-conscious web analytics and GA4/Google Tag Manager style event forwarding. Do not send free-text bill content or sensitive details to advertising systems.

Recommended launch events include first open, bill search, suggested match accepted, plan generated, provider message copied, email draft opened, AI handoff copied, account created and verified purchases.

## Validation

Run the API/domain/frontend-contract suite:

```text
cd artifacts/api-server
python -m unittest discover -s tests -v
```

The repository is intentionally independent of Replit Agent and contains no Replit runtime dependency.

See `DEPLOYMENT.md` for deployment guidance and `AUDIT_AND_FIXES.md` for the audit history and known external launch requirements.
