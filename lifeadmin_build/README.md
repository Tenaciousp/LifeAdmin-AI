# HomeAdmin

> Release target changed on 12 October 2026. The approved direction is a paid Apple App Store and Google Play download, £1.99 GBP or local store equivalent, without a trial, subscription or HomeAdmin account. Household planning and saved data must run locally, without automatic transmission to TenaciousPL or AI providers. The website serves examples, support and future product promotion/sales.
>
> The code described below is still the hosted web implementation. Its server storage, account flow and Stripe checkout do not satisfy the new release target. Do not publish the hosted privacy or access descriptions as native-app promises. Read [LAUNCH_POLICIES_REVIEW.md](LAUNCH_POLICIES_REVIEW.md) for the current requirements and backup acceptance checks.

## Native migration sequence

1. Bundle the category/goal catalogue and move routing, task normalisation and plan generation into the client. Preserve the four output sections and existing energy-comparison safeguards. Planning must work offline without a Python server or external AI.
2. Replace server task/plan operations with persistent device storage, including schema upgrades and safe writes. Retain saved work across restart and app updates.
3. Replace the customer account, password recovery and Stripe purchase journey with the paid-store download flow. Keep price information in store listings and promotional material, not app working screens.
4. Add customer-controlled export/import with validated, versioned backups and safe failure handling.
5. Package the client for Apple and Android, configure eligible operating-system backups and verify native persistence and restoration. A browser-storage experiment is not evidence of native backup support.
6. Remove automatic household-data network paths and analytics from the native customer flow. Support and examples open the website without appending household data.
7. Verify offline journeys, network behaviour, update retention, deletion, exports and native restore using synthetic records. Test store installation and purchase re-download separately from data restoration.
8. Rewrite public support/privacy/refund wording for the verified native behaviour, then complete platform requirements and release review. Preserve existing production data and release safeguards throughout migration.

This is a migration plan, not an implemented native release. Existing hosted tests remain useful regression coverage but do not establish native readiness.

## Existing hosted implementation

HomeAdmin is a privacy-light household-admin assistant for bills, renewals, subscriptions and recurring payments.

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
- No automatic sharing with another AI service; optional Gemini API generation sends only the request the customer reviews and explicitly approves
- Guest work is isolated with a signed browser cookie
- Signed-in data is separated by account
- Analytics is opt-in and excludes bill text, provider messages, addresses and account details
- Account and saved-plan deletion are owner-scoped

## Pricing

- **HomeAdmin Complete:** £1.99 UK / $1.99 US one time, all planning modes included
- No subscription

Equivalent local store tiers can be considered later only as part of a separately approved native release.

## Run locally without Replit

Requirements: Python 3.11+ and Node.js 20+.

```text
npm ci
npm run dev:api
npm run dev:web
```

The web app runs with Vite and proxies API calls to the Python service. SQLite is used automatically when no PostgreSQL database is configured.

For a production-style single-server build:

```text
npm ci
npm run build:web
npm start
```

The Python service then serves the built React application and API from one process.

## Storage

Development needs no external database. HomeAdmin uses SQLite by default. Set `DATABASE_URL` to a PostgreSQL URL for a managed production database. PostgreSQL support is optional and requires the package listed in `requirements.txt`.

## Production configuration

Copy `.env.example` and configure only services that the owner has approved. Important production values may include:

- `SESSION_SECRET`
- `APP_BASE_URL`
- `DATABASE_URL` for PostgreSQL, if used
- Stripe credentials and the one-time complete-product Price ID, only if live payments are approved
- `ADMIN_EMAILS`

Never commit live credentials.

## Payments

Checkout is not live by default. The interface remains in preview until the complete-product Stripe Price ID and Stripe credentials are configured. Enabling live checkout, hosting or any paid service requires explicit owner approval.

## Manual AI comparison

Customers can edit and copy a privacy-reminded comparison prompt to Gemini, Microsoft Copilot, ChatGPT, Claude or Perplexity. The app opens the selected assistant but does not automatically transmit customer details or require paid AI usage.

For in-app letter, reply or plan drafting, customers can choose optional Gemini generation after reviewing the exact request and confirming a data-sharing notice. The app sends the request through a server-side proxy to Google; no provider key is included in the app or customer device. This route stays disabled until the service and privacy disclosures are configured. Google free-tier limits and data terms apply. Copilot remains the default manual handoff and offline templates remain available without AI.

## Analytics readiness

Analytics is disabled until a visitor explicitly opts in. Do not send free-text bill content, provider messages, addresses, customer references or other sensitive details to analytics or advertising systems.

## Validation

From `lifeadmin_build`, run the same core checks used by CI:

```text
npm ci
pip install -r requirements.txt
npm test
npm run typecheck
npm run build:web
```

CI also starts the Python API and runs `scripts/smoke_api.py` against the live process. The smoke path checks health, the 12-category / seven-goal catalog, preview-only pricing, guest energy-task creation, provider/reference preservation, structured plan generation, cross-guest isolation, guest-to-account migration, sign-out/sign-in isolation, saved-plan/task deletion and permanent account deletion. Passing CI is not a substitute for browser, iPad/mobile, clipboard, popup or physical-device QA.

See `FINAL_QA.md` for the owner-review checklist, `DEPLOYMENT.md` for deployment guidance and `AUDIT_AND_FIXES.md` for the historical audit record.
