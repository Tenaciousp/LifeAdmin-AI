# LifeAdmin launch policies: owner review

## Updated owner requirements, 12 October 2026

Status: requirements agreed in conversation; architecture change not implemented or deployed. The earlier account-based policy text below is historical and must not be published as the current offer.

The owner requires:
- Paid native download through Apple App Store and Google Play, targeting £1.99 GBP or the store's local equivalent. No free trial, free tier, subscription or in-app upgrade.
- No LifeAdmin account or sign-in in the purchased app. The customer's store account handles the purchase separately.
- Website purpose: product examples, support, promotion and future product sales. Existing Stripe checkout is not the launch purchase route for this native release.
- Household bills, task details and saved plans remain on the customer's device inside the app, retained during use until the customer deletes them.
- No automatic transmission of household information to LifeAdmin's server, external AI providers, analytics or support.
- Retain only necessary sales, refund, accounting, tax and support correspondence records separately from household planning information.
- Continue operating a paid product business and developing future apps. This is not an approved lifetime service guarantee or a subscription instruction.
- Defer the public business-address decision until before sales or platform verification. Do not publish a home address or form a company.
- The voluntary 14-day full-refund proposal remains unapproved.

### What must change before these statements describe the product

The application at `c9a51de381e9ce2f9235b1a09f2f9dfa10184bad` is an account-based hosted web app. It currently stores household planning records on the server and conditionally supports external AI generation. Removing only the sign-in screen would neither make data local nor preserve proper paid-access checks.

Implementation must move planning and persistent household data to the device, remove app-account/recovery requirements from the target customer flow, prevent automatic household-data network transmission, and define a purchase entitlement appropriate to the selected distribution channel. Do not erase existing records or disable current production access controls as a shortcut.

### Confirmed distribution and customer-controlled backups

The owner confirmed the paid Apple App Store and Google Play route on 12 October. Native purchase, re-download and store refund arrangements replace the hosted-account purchase flow for this target release. No Stripe account, existing purchase or production access setting is changed by this decision. Store prices, product availability and release approval still require verification.

Saved bills and plans must survive normal app closure, restart and app updates. Their primary storage is on the customer's device. Tenaciouspl will not retain a server copy of household planning data.

Operating-system backups are conditional, not a guaranteed recovery service. Apple's iCloud Backup includes eligible app data when the customer enables backup and includes the app. Android Auto Backup depends on device settings, eligible storage, app configuration, backup conditions and its 25 MB per-app quota. A completed, usable backup must exist for restoration. Re-downloading a purchased app does not itself prove restoration of household information.

Customer-controlled operating-system cloud backup is consistent with no Tenaciouspl household-data service, but is not consistent with a blanket promise that information never leaves the device. Privacy wording must explain optional Apple/Google backup separately. User-directed export or sharing also leaves the device only through the customer's chosen action.

Implement a customer-controlled backup export/import function as an additional recovery option. Keep exports private by default, warn about sensitive contents before sharing, validate imports before replacing saved work, and preserve current data if an import fails. No automatic upload, support attachment or household-data telemetry.

Tenaciouspl support will help with app faults and backup instructions. Without a retained server copy, support cannot reconstruct missing household records for an individual purchaser. Do not use this limitation to exclude statutory consumer rights or responsibility for defective software.

Before claiming backup support, test:
- Offline planning, editing, saving, reopening and restart.
- Native app update without loss of existing records.
- Export/import round trip, invalid or incompatible backup, and interrupted write.
- Apple backup/restore and Android backup/restore with representative synthetic records.
- Backup-disabled and no-backup scenarios with accurate customer guidance.
- Explicit deletion, clean installation and supported device transfer behaviour.
- Network inspection proving no automatic household-data transmission to Tenaciouspl, AI services, analytics or support.

Official backup references checked on 12 October 2026:
- https://support.apple.com/en-gb/108770
- https://developer.android.com/identity/data/autobackup

The earlier voluntary 14-day refund draft is not a free trial and remains unapproved. Native-store refund procedures and applicable consumer rights need separate review before customer terms are published.

### Minimum business-record retention

Keep necessary sales and expense records from the start; retention is not triggered only after crossing a tax-reporting threshold. Keep accounting records separately, without collecting household bills or plans for tax purposes.

For self-employed tax records, HMRC's general rule is at least five years after the relevant tax year's 31 January submission deadline, with exceptions including very late returns. Apply the relevant rule to the actual tax circumstances and record type.

Support correspondence has no universal fixed UK GDPR retention period. Retain only what is necessary for the support matter, applicable legal obligations and justified complaint/dispute handling; delete or anonymise once those reasons expire. Do not apply the tax-record period automatically to every support email or attachment. A documented schedule and deletion process still need completion.

Sources checked on 12 October 2026:
- https://www.gov.uk/self-employed-records/how-long-to-keep-your-records
- https://ico.org.uk/for-organisations/advice-for-small-organisations/information-security/data-storage-advice/

No household record, account, payment, mailbox, runtime setting or public policy was changed by this requirements update. Existing CI validates the previous hosted architecture, not the requested device-only architecture.

---

## Historical hosted-web draft, not approved for publication

Prepared: 12 October 2026  
Application evidence: `200bf0b0af33ff2c90733ebffe5ad6235bce0fd0`, full CI #294 passed  
Status: draft only. Not approved, published or incorporated into checkout.

This file contains proposed customer wording and decisions required before publication. Bracketed fields must be completed. No business address, VAT status, service duration, retention period or provider agreement is inferred from the publisher name or purchased domain. Application tests do not establish legal compliance.

## Owner decisions

| Decision | Proposed starting point | Still required |
|---|---|---|
| Trader | Paul Lonergan trading as Tenaciouspl; tenaciouspl@icloud.com | Business geographical address authorised for customer disclosure |
| Offer | One £1.99 GBP payment, all current planning functions, no subscription or separate upgrade | Confirm total tax-inclusive checkout price and VAT status |
| Duration | Continued access without a recurring charge | Agree a sustainable minimum service commitment and closure/refund arrangements; do not promise lifetime hosting |
| Cancellation | Voluntary full refund on a request made within 14 days of purchase; no cancellation-right waiver | Owner approval, final contract classification and tested refund/access handling |
| Production AI | Keep optional server-side OpenAI generation disabled for initial launch unless separately reviewed | Confirm actual settings privately; disclose and review provider processing before enabling |
| Recovery email | Existing approved mailbox or approved sender service | Sender permission, private credentials, actual delivery, operational monitoring |
| Retention | A documented schedule for each data category | Choose justified periods, implement deletion/backup expiry and test them |
| Backup | Independently recoverable encrypted backup | Key custody, approved destination, retention, restore owner and failure alerts |

The 14-day refund proposal is a commercial choice for review, not a declaration that every feature is legally classified as a download. The hosted planning service needs its final classification reviewed. A low purchase price alone is not treated as permission to omit customer disclosures or cancellation rights.

## Proposed purchase terms

**LifeAdmin AI from Tenaciouspl**

LifeAdmin helps organise household bill tasks and prepare saved plans, provider messages, checks and next steps. You review the information and decide which actions to take. You send provider messages yourself.

The seller is Paul Lonergan trading as Tenaciouspl. Contact tenaciouspl@icloud.com. Our business address is [OWNER-APPROVED BUSINESS ADDRESS].

One payment of £1.99 GBP includes all current planning functions. There is no subscription or separate upgrade charge. [CONFIRM FINAL TOTAL, TAX TREATMENT AND CHECKOUT DISPLAY BEFORE PUBLICATION.]

Access is linked to your purchasing account. Sign in with the same account to return to your plans. Keep account credentials private. Contact support about missing access before making another payment.

Access lasts [OWNER-APPROVED SERVICE DURATION / CONTINUITY COMMITMENT]. [ADD REVIEWED SERVICE-CLOSURE NOTICE, CUSTOMER REMEDY AND DATA-RETURN ARRANGEMENTS.] No guaranteed lifetime hosting or future native-store entitlement is offered by this draft.

LifeAdmin opens in a supported web browser. [INSERT VERIFIED BROWSER/DEVICE REQUIREMENTS AFTER ACCEPTANCE.] Native store releases are a separate future phase. You need an internet connection for hosted account functions.

Plans contain general information and drafts. Check figures, provider rules and deadlines before acting. Savings and provider outcomes are not guaranteed. For decisions involving legal, financial, medical, tax or insurance matters, use appropriate official information and qualified support.

Your statutory consumer rights are unaffected. [ADD FINAL COMPLAINT PROCESS AND CONTRACT CONFIRMATION FORMAT.] These terms will be available in a format you can save.

### Review notes

Before taking payment, provide the final seller details, total price, scope, duration, access requirements, cancellation process and terms in a durable format. Confirm the contract and retain the agreed version. No confirmation email, terms-acceptance record or printable final terms are claimed as implemented by this file.

If immediate-supply cancellation rights are waived under the final legal classification, review the specific consent and acknowledgment requirements. Do not treat a generic Stripe terms checkbox as proof of the separate requirements. The simpler proposal above retains the refund window instead.

## Proposed cancellation and refund wording

You have a 14-day refund window under our voluntary policy. Email tenaciouspl@icloud.com within 14 days of purchase and tell us you want to cancel. No reason is required under this policy.

Include the email used for your LifeAdmin account, purchase date and payment reference if available. Never send your password, reset link, full card number or security codes.

We will verify the purchase and explain the access and saved-data consequences before processing the refund. Approved refunds return to the original payment method. [CONFIRM PROCESSING DEADLINE AND PROVIDER TIMING BEFORE PUBLICATION.]

A completed refund ends paid planning access. Stored information follows the approved privacy retention rules. [IMPLEMENT AND TEST THIS ENTITLEMENT OUTCOME; CURRENT PAYMENT SUCCESS HANDLING DOES NOT ESTABLISH REFUND REVOCATION.]

Problems involving faulty or misdescribed content or services remain subject to statutory consumer remedies. The voluntary window does not replace those rights. Contact support about a problem even after 14 days.

### Cancellation request template

To: Paul Lonergan trading as Tenaciouspl  
Business address: [OWNER-APPROVED BUSINESS ADDRESS]  
Email: tenaciouspl@icloud.com

I want to cancel my LifeAdmin purchase.

Account email:  
Purchase date:  
Order or payment reference, if available:  
Name:  
Date:

An ordinary email stating the cancellation request is also accepted under the proposed policy. Do not ask for passwords or full payment-card details.

## Proposed privacy notice

**Who is responsible**

Paul Lonergan trading as Tenaciouspl is responsible for the LifeAdmin account and planning service described here. Contact tenaciouspl@icloud.com or [OWNER-APPROVED BUSINESS ADDRESS] about privacy.

**Information used**

LifeAdmin stores your account email, a salted password hash, session records, tasks, submitted task details, saved plans and purchase entitlement records. Optional recovery stores reset-token digests and sends recovery messages through the approved email provider. Do not put passwords, full payment-card details or security codes into task notes.

Stripe handles hosted checkout. LifeAdmin uses payment references and verified purchase information to associate access with the purchasing account. Deleting an app account does not itself erase Stripe's separate payment records or process a refund.

**Purposes and proposed lawful bases**

Account operation, planning storage and purchased access: performance of the customer contract, where necessary. Security and abuse prevention: [DOCUMENT THE APPROPRIATE BASIS AND ASSESSMENT]. Optional analytics: consent. Required accounting records: [CONFIRM APPLICABLE LEGAL OBLIGATIONS AND NECESSARY RECORDS].

These are proposed bases to assess and document, not approval of every processing activity. Special-category information needs additional review. Do not request unnecessary sensitive details for household planning.

**Recipients and AI**

The existing app host is Render; the reviewed service is configured in Frankfurt. Stripe processes checkout information. The selected recovery email provider processes recipient addresses and recovery email content. [CONFIRM CONTRACTS, ACTUAL PROCESSING LOCATIONS AND TRANSFER SAFEGUARDS.]

Manual links to external AI assistants are separate from optional server-side generation. The manual handoff lets you review the prompt and choose what to submit to the selected service. When server-side OpenAI generation is configured, the API sends submitted task details to OpenAI after a generation request. Without an API key, the server uses its built-in planning output. [CONFIRM THE LAUNCH CONFIGURATION AND COMPLETE THE RELEVANT PROVIDER DISCLOSURES.]

Do not publish a blanket promise that no information reaches an AI provider. This draft does not establish whether a provider is currently configured on Render.

**Retention and deletion**

Keep data only for approved, documented periods. [INSERT COMPLETED RETENTION SCHEDULE BELOW.]

Account deletion removes the app account's tasks, plans, sessions and purchase records. Provider-held payment or email records and backups have separate approved retention rules. Explain those rules before publication. Account deletion and a payment refund are distinct actions.

**Choices and rights**

Contact support to request access, correction or deletion, or exercise other applicable data-protection rights. Withdrawal of optional analytics consent does not remove purchased access. Explain the request-verification process without asking for passwords. You also have the right to complain to the Information Commissioner's Office: https://ico.org.uk/make-a-complaint/.

[CONFIRM RESPONSE PROCESS, LEGAL EXCEPTIONS, AUTOMATED DECISION-MAKING POSITION AND FINAL CONTACT DETAILS.] This draft does not promise that every request always results in immediate deletion of every third-party record.

### Retention schedule to complete

| Category | Verified code behaviour | Owner decision / operational work |
|---|---|---|
| Accounts, tasks, plans and purchase entitlement | Active storage; account deletion cascades through these app records | Active-account duration, inactive-account handling, refund-data policy |
| Sessions | Thirty-day expiry; expired sessions are purged during schema maintenance; reset revokes previous sessions | Confirm operational practice and customer wording |
| Reset links | Thirty-minute validity; digests stored; all links removed on reset; expired rows cleaned during issuance | Expiry is not guaranteed immediate physical deletion; approve cleanup policy |
| Recovery queue | Bounded in-memory jobs; restart loses pending jobs | Durable-delivery decision, failure alerts and handling |
| Support emails | Outside app storage | Mailbox access, retention, request handling |
| Stripe billing records | Separately held by payment provider | Identify records, provider roles and required retention |
| Backups | Only synthetic encrypted rehearsal evidenced | Production destination, recoverable key, retention and deletion process |
| Analytics / hosting logs | Optional analytics bridge; host and provider retention needs confirmation | Final providers, cookies, actual retention and consent validation |

## Pre-publication checklist

- Complete the address, duration, tax and retention fields; approve the final drafts.
- Review hosted-service/digital-content classification and customer remedies.
- Verify a durable pre-contract disclosure and contract confirmation, including the terms version.
- Test refunds, their entitlement consequences and any saved-data handling before promising the policy.
- Align website, app and checkout disclosures; keep pricing outside app working screens.
- Confirm AI and email-provider settings privately, with accurate recipients and transfer disclosures.
- Finish secure browser acceptance and physical iPad testing last.
- Keep maintenance and auto-deploy safeguards until explicit app release approval.

## Official sources checked on 12 October

- GOV.UK, Online selling: https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling
- GOV.UK, Distance selling: https://www.gov.uk/online-and-distance-selling-for-businesses
- ICO, Privacy information: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/
- ICO, Contract basis: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/contract/
- ICO, Individual rights: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/
- ICO, Right to erasure: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/

No policy was published, no customer contract changed and no refund, email, account, payment or production setting was altered.
