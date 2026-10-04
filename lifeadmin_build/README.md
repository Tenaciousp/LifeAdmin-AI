# LifeAdmin AI

LifeAdmin AI is a privacy-light household-admin assistant for bills, renewals, subscriptions and recurring payments.

**Promise:** Sort bills, renewals and subscriptions without the admin headache.

Customers search for or choose a household bill, select a goal, add only what they know, review useful missing details, and generate four reliable sections:

1. Next steps
2. Provider message
3. Things to check
4. Approval checklist

The product includes 12 household categories, seven action-based goals, savings-first shortcuts, category-specific plans, a dedicated unknown-payment journey, saved plans, manual AI comparison handoff, account controls, a protected admin dashboard and one-time pricing.

## Privacy model

- No bank connection required
- No mailbox access required
- No automatic provider contact
- No automatic sharing with another AI service
- Guest work is isolated with a signed browser cookie
- Signed-in data is separated by account
- Analytics is opt-in and excludes bill text, provider messages, addresses and account details
- Account and saved-plan deletion are owner-scoped

## Pricing

- **Core:** £0.99 / $0.99 one time
- **All Access:** an additional £1.99 / $1.99 one time
- No subscription

Equivalent local store tiers can be considered later only as part of a separately approved native release.

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

Copy `.env.example` and configure only services that the owner has approved. Important production values may include:

- `SESSION_SECRET`
- `APP_BASE_URL`
- `DATABASE_URL` for PostgreSQL, if used
- Stripe credentials and both one-time price IDs, only if live payments are approved
- `ADMIN_EMAILS`

Never commit live credentials.

## Payments

Checkout is not live by default. The interface remains in preview until both one-time products and Stripe credentials are configured. Enabling live checkout, hosting or any paid service requires explicit owner approval.

## Manual AI comparison

Customers can edit and copy a privacy-reminded comparison prompt to Gemini, Microsoft Copilot, ChatGPT, Claude or Perplexity. The app opens the selected assistant but does not automatically transmit customer details or require paid AI usage.

## Analytics readiness

Analytics is disabled until a visitor explicitly opts in. Do not send free-text bill content, provider messages, addresses, customer references or other sensitive details to analytics or advertising systems.

## Validation

From `lifeadmin_build`, run the same core checks used by CI:

```text
npm install
pip install -r requirements.txt
npm test
npm run typecheck
npm run build:web
```

CI also starts the Python API and runs `scripts/smoke_api.py` against the live process. The smoke path checks health, the 12-category / seven-goal catalog, preview-only pricing, guest energy-task creation, provider/reference preservation, structured plan generation, cross-guest isolation, guest-to-account migration, sign-out/sign-in isolation, saved-plan/task deletion and permanent account deletion. Passing CI is not a substitute for browser, iPad/mobile, clipboard, popup or physical-device QA.

See `FINAL_QA.md` for the owner-review checklist, `DEPLOYMENT.md` for deployment guidance and `AUDIT_AND_FIXES.md` for the historical audit record.
