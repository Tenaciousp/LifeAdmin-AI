# LifeAdmin AI monetisation and growth

## One-time pricing

**Core: £0.99 UK / $0.99 US once**

Includes the complete everyday household-admin workflow: 12 categories, seven goals, next steps, provider messages, things to check, approval checklists, unknown-payment support and manual AI handoff.

**All Access: an additional £1.99 UK / $1.99 US once**

Adds deeper negotiation support, complaint and escalation help, switching guidance, comparison prompts and advanced planning modes.

Core + All Access is £2.98 / $2.98 total. There is no subscription. Native stores can use an equivalent attractive local price tier where their pricing system requires it.

## Web payments

Live Stripe checkout is enabled only when both the Stripe secret and the matching product price ID are configured. The customer UI remains in preview mode when payment configuration is incomplete. A purchase entitlement is granted only after Stripe reports a paid session.

Required production secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CORE_APP`
- `STRIPE_PRICE_ALL_ACCESS`

Never place live secrets in client code or source control.

## Ads and measurement readiness

Paid acquisition should start only after the final product, live payments, privacy disclosures and conversion tracking have been verified.

The web client contains a privacy-light analytics bridge suitable for Umami and later GA4 / Google Tag Manager configuration. Useful conversion events include start flow, bill search, category and goal selection, suggestion accepted, plan generated, provider message copied, email opened, AI handoff opened, account created and checkout started.

Do not send free-text bill descriptions, provider messages, email addresses, account identifiers, postal addresses or payment details as advertising/analytics event properties.

A sensible launch sequence is: product QA, measurement QA, small campaign test, conversion-quality review, then controlled scaling.
