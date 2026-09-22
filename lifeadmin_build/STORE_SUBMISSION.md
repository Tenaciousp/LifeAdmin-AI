# LifeAdmin AI release and store submission pack

## Customer-facing listing copy

**App name:** LifeAdmin AI  
**Short description:** Sort bills, renewals and subscriptions without the admin headache.  
**One-line pitch:** Get a clear plan, provider message and checklist for household bills and recurring payments.

### Description

LifeAdmin AI guides you through everyday household admin without requiring a bank connection or mailbox access.

Search for a bill, provider or payment, choose what you want to achieve, add only the details you know and receive practical next steps, a provider-ready message where appropriate, things to check and an approval checklist.

The current product covers 12 household categories and seven goals, including bill checks, renewals, price reduction, cancellation/switching, disputed charges, provider contact and unknown-payment identification.

LifeAdmin AI does not automatically contact providers, cancel services, make purchases or send information to another AI assistant. You review every action yourself.

### Key features

- Search-first bill and payment picker
- 12 household bill/payment categories
- Seven practical customer goals
- Smart suggested routing
- Category- and goal-specific detail fields
- Dedicated unknown recurring-payment flow
- Structured next steps, provider message, checks and approval list
- Manual, privacy-warned AI handoff
- Try before creating an account
- Private account storage and in-app deletion
- One-time Core and All Access pricing, no subscription

### Suggested keywords

life admin, household bills, subscriptions, renewals, bill checker, cancellation, recurring payments, insurance renewal, energy bill, council tax

## Screenshot plan

Use real final-build screenshots without customer data:

1. Landing page with “Start with a bill”.
2. Search-first picker and popular household examples.
3. Goal selection and dynamic details.
4. Structured result with next steps and provider message.
5. Unknown-payment identification route.
6. Privacy-safe AI handoff preview.
7. One-time Core and All Access pricing.
8. Account/save and deletion controls.

## Privacy and data-safety summary

Validate this section against the final production/native binaries before submission:

- Email address is collected only for registered account authentication and optional checkout receipt prefill.
- Task details and generated plans are user content used to provide app functionality.
- Purchase entitlements and transaction references are used to provide paid access.
- No bank or mailbox account connection is required.
- No customer task content should be sent to advertising analytics.
- Nothing is automatically sent to ChatGPT, Claude or another external AI assistant from the handoff feature.
- Account deletion is available inside the product and removes account-linked records.
- Production traffic must use HTTPS.

The publisher still needs final legal identity, privacy contact, support URL, privacy-policy URL, terms URL and retention policy.

## Current web readiness

### Implemented and locally validated

- [x] LifeAdmin AI household-bill positioning and responsive landing page
- [x] Search/suggestion domain for 12 categories and seven goals
- [x] Dynamic category/goal fields
- [x] Dedicated unknown-payment plan and bank-query draft
- [x] Four structured result sections
- [x] Genuine provider-message email gating
- [x] Manual privacy-safe AI handoff
- [x] Guest workspace isolation and signed-in account storage
- [x] Password hashing, protected sessions and account deletion
- [x] Stripe checkout integration points and paid-status entitlement checks
- [x] Protected admin metrics endpoint/dashboard
- [x] Privacy-light analytics bridge for later GA4/Google Ads measurement
- [x] Automated regression contracts including nine representative scenarios

### Owner/platform actions before paid web launch

- [ ] Add production `DATABASE_URL`
- [ ] Add production AI provider credential/configuration if live-model output is required
- [ ] Configure Stripe secret, webhook secret and final Core/All Access price IDs
- [ ] Add final legal/business contact details and hosted privacy/terms/support URLs
- [ ] Configure administrator allowlist
- [ ] Run final browser/device QA in the deployed environment

## Native-store actions later

- [ ] Build and test iOS and Android packages
- [ ] Configure secure native session storage
- [ ] Create Core and All Access in-app products
- [ ] Implement and verify StoreKit/Google Play Billing and Restore Purchases
- [ ] Configure signing and developer accounts
- [ ] Complete App Privacy and Google Data Safety forms from final binaries
- [ ] Test physical devices and accessibility
- [ ] Upload screenshots, ratings, declarations and reviewer notes
- [ ] Submit and resolve store-review feedback

## Reviewer note

LifeAdmin AI prepares household-admin plans and draft messages. It does not access a customer's bank or provider account and does not perform cancellations or other real-world actions. Reviewers can use the non-account planning flow to exercise the product before testing purchase/account features.
