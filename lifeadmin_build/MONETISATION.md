# LifeAdmin AI monetisation and growth

## One-time pricing

**LifeAdmin AI Complete: £1.99 UK / $1.99 US once.**

One purchase includes 12 household categories, seven goals, next steps, provider messages, checklists, unknown-payment support, manual AI handoff, advanced negotiation, switching, complaint/escalation support and all advanced planning modes in this release.

There is no subscription, separate upgrade or second payment. Existing Core and All Access purchasers retain complete access under the migration rule. The displayed currency selector is informational; the Stripe checkout amount and currency must match the approved market price before payment is enabled.

## Web payments

Live Stripe checkout is enabled only when both the Stripe secret and the matching product price ID are configured. The customer UI remains in preview mode when payment configuration is incomplete. A purchase entitlement is granted only after Stripe reports a paid session. Do not activate checkout until the actual Stripe Price currency and amount match the displayed market pricing; the UI currency selector does not select a Stripe Price.

Required production secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_LIFEADMIN_COMPLETE` (one-time Stripe Price for the complete product; verify market/currency before launch)

Never place live secrets in client code or source control.

## Ads and measurement readiness

Paid acquisition should start only after the final product, live payments, privacy disclosures and conversion tracking have been verified.

The web client contains a privacy-light analytics bridge suitable for Umami and later GA4 / Google Tag Manager configuration. Useful conversion events include start flow, bill search, category and goal selection, suggestion accepted, plan generated, provider message copied, email opened, AI handoff opened, account created and checkout started.

Do not send free-text bill descriptions, provider messages, email addresses, account identifiers, postal addresses or payment details as advertising/analytics event properties.

A sensible launch sequence is: product QA, measurement QA, small campaign test, conversion-quality review, then controlled scaling.
