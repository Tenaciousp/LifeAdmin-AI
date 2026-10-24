> Branding note, 19 October 2026: the current product is **HomeAdmin**, published by **TenaciousPL**. This document retains historical LifeAdmin names, commands and QA evidence. Use `STORE_SUBMISSION.md` and `BRANDING.md` for current release material.

# LifeAdmin AI deployment guide

Status, 11 October 2026: release preparation only. Draft PR #2 is unmerged, the existing Render service retains maintenance mode and disabled automatic deployment, and live sales are not approved. Use [issue #3](https://github.com/Tenaciousp/LifeAdmin-AI/issues/3) for the current release gates. The promotional website is separate from the app and does not establish app readiness.

Publisher: Paul Lonergan trading as TenaciousPL. Support: tenaciouspl@icloud.com. The purchased promotional domain is tenaciouspl.co.uk; do not use its origin as APP_BASE_URL unless the app is deliberately hosted there and its HTTPS origin has been verified.

## Recommended path

LifeAdmin AI now runs as a standard React/Vite frontend plus Python HTTP API. Replit is not required.

For development, use the built-in SQLite database. For a public service, use either a host with a persistent volume for SQLite or a managed PostgreSQL database.

## Single-container deployment

The included Dockerfile builds the React frontend and then starts the Python service, which serves both the SPA and `/api` routes.

Build from the `lifeadmin_build` directory with `docker build -t lifeadmin-ai .`. CI, local setup and the container use `npm ci` with the committed lockfile. Local dependency folders, build output, environment files and SQLite runtime data are excluded from the Docker build context. After an intentional dependency change, run `npm install` and commit the updated lockfile.

Production environment requirements:

- `APP_ENV=production`
- `PAID_ACCESS_REQUIRED=true` for paid public launch; explicit `false` only for authorised private QA. Production startup refuses live payment keys unless paid access is required.
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

## Upfront access

The web launch requires a signed-in account and verified Complete purchase before task access, suggestions or plan generation. Planning API routes enforce this server-side; hiding controls is not the security boundary. Account sign-in, deletion, product/access checks, payment return and webhook delivery stay available.

There is no app working-screen price card or free public planning tier. The pre-access screen links to the website offer and opens secure Stripe checkout without repeating the price in the app. Account purchase access is restored by sign-in. Existing paid guest access is honoured, but new paid-mode checkout requires an account.

Private QA uses `PAID_ACCESS_REQUIRED=false`; this is not a public launch configuration. Set `PAID_ACCESS_REQUIRED=true` before release and verify unpurchased access is denied, unpaid/cancelled sessions stay denied, paid return enables only the purchaser, and sign-out/relogin preserve the boundary. Do not publish a website purchase link until the final HTTPS app origin and this flow are verified.

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

The native app keeps bundled planning, offline templates and Copilot handoff available without AI. Optional in-app Gemini drafts require `GEMINI_DRAFTS_ENABLED=true` and a server-only `GEMINI_API_KEY`; default is disabled. `/api/ai/draft` accepts only the reviewed prompt after a consent flag, stores no prompt or response, applies five requests per IP per minute and a 50-request daily process limit, and sends the request to Google Gemini. The native bundle needs `VITE_AI_DRAFT_API_BASE_URL` set to the HTTPS API origin at build time. Do not publish or enable this route before the app privacy policy, data-transfer notice, usage budget and service availability are reviewed. User API keys must never be placed in a production app.

## Admin access

The admin dashboard is protected by signed-in account identity plus the `ADMIN_EMAILS` allowlist. Do not use a general customer account as an administrator unless its email is intentionally allowlisted.

## Analytics and advertising

Analytics requires explicit consent. Events are sanitised to avoid transmitting free-text provider messages, addresses, descriptions, notes or account details. Add GA4/Google Ads identifiers only after privacy disclosures and consent behaviour have been checked in the production jurisdiction.

Do not start paid acquisition until conversion events, purchase attribution, payment flow and product QA are verified end to end.

## Native stores

The current deliverable is a web application. Apple App Store and Google Play release work remains a separate phase requiring developer accounts, native packaging, signing, device QA, store assets and platform declarations. The intended native offer is an upfront paid download at £1.99 or a store-local equivalent; store billing and acceptance must be reviewed during that separate phase.

## Production startup preflight, 12 October

The release candidate checks configuration before binding the HTTP server. Production requires SESSION_SECRET with at least 32 non-whitespace characters and rejects DEMO_PAYMENTS=true. Length checking does not prove randomness; generate and privately retain a strong, stable secret rather than a memorable phrase.

Live Stripe credentials require PAID_ACCESS_REQUIRED=true, a fixed HTTPS APP_BASE_URL without credentials/path/query/fragment, the webhook secret and the Complete GBP Price configuration. Enabled password recovery requires the same origin shape and complete encrypted SMTP settings. These checks verify local configuration shape and presence, not ownership of a domain, reachability, provider agreement, actual delivery or verified Stripe Price/endpoint operation.

Unavailable production account storage or schema initialization stops startup. Startup errors do not print connection exception details. Development preview and the earlier production Docker smoke environment without live payments/recovery retain their existing configuration path; no new Docker runtime pass is claimed by these source checks.

No Render settings or credentials were changed. Complete secure acceptance and approve deployment separately. Marketing domain tenaciouspl.co.uk remains active with active HTTPS; native refresh on 12 October still reports www pending, despite active provider/SSL status. Use the root marketing address. Marketing hosting is separate from the app origin and deployment.
