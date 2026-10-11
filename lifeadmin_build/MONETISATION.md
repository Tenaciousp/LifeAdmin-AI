# LifeAdmin AI monetisation and growth

## One-time pricing

**LifeAdmin AI Complete: one purchase, no subscription.**

**£1.99 GBP once for the complete app.** All current planning features are included. No country selector, regional-price menu, subscription or separate upgrade.

One purchase includes 12 household categories, seven goals, next steps, provider messages, checklists, unknown-payment support, manual AI handoff, advanced negotiation, switching, complaint/escalation support and all advanced planning modes in this release.

There is no subscription, separate upgrade or second payment. Existing Core and All Access purchasers retain complete access under the migration rule. Checkout uses the GBP Price only. The server verifies the Stripe Price currency, one-time type, active status and exact amount of 199 pence before creating a Checkout Session. Final payment, tax and release checks remain required before live sales.

## Web payments

Live Stripe checkout is enabled only when both the Stripe secret and the matching product price ID are configured. The customer UI remains in preview mode when payment configuration is incomplete. A purchase entitlement is granted only after Stripe reports a paid session. Do not activate checkout until the actual Stripe Price currency and amount match the displayed £1.99 GBP price.

Required production secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP` (active, one-time GBP 199)
- Legacy `STRIPE_PRICE_LIFEADMIN_COMPLETE` is accepted only as the GBP fallback, and must be verified as GBP £1.99 before checkout.

Never place live secrets in client code or source control.

## Ads and measurement readiness

Paid acquisition should start only after the final product, live payments, privacy disclosures and conversion tracking have been verified.

The web client contains a privacy-light analytics bridge suitable for Umami and later GA4 / Google Tag Manager configuration. Useful conversion events include start flow, bill search, category and goal selection, suggestion accepted, plan generated, provider message copied, email opened, AI handoff opened, account created and checkout started.

Do not send free-text bill descriptions, provider messages, email addresses, account identifiers, postal addresses or payment details as advertising/analytics event properties.

A sensible launch sequence is: product QA, measurement QA, small campaign test, conversion-quality review, then controlled scaling.
