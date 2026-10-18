# LifeAdmin store submission pack

Updated 18 October 2026. This pack supersedes earlier account-based web release plans.

## Agreed offer

LifeAdmin is a paid download: £1.99 in the UK, with store-managed local equivalents.
All planning features shipped in this release are included. No trial, subscription,
LifeAdmin account, sign-in, in-app checkout or separate upgrade. Prices belong in
the store and promotional website, not inside the app. Separate future products
are outside this purchase promise. Store price configuration still needs verification.

## Listing copy

App name: **LifeAdmin**
Apple subtitle: **Household bills, made simpler**
Google short description: **Manage household bills in one place. List, plan and save.**
Strapline: **List, plan and save.**
Keywords: bills,household,renewals,subscriptions,planner,budget,energy,insurance,cancellation

### Full description

Keep household bills and practical next steps together with LifeAdmin.

Search for a bill or provider, choose your goal and add the details you know.
Build a clear plan for reviewing a bill, preparing for renewal, considering a
switch, cancelling a service, querying a charge or contacting a provider.

LifeAdmin includes 12 household categories and seven goals, with planning styles
for different situations. Save bills and plans, update bill status, reopen saved
plans and copy draft messages when you are ready to act.

Household records stay in the app's storage on your device. No LifeAdmin account,
bank connection or mailbox access is required. Planning uses bundled guidance
and works offline. LifeAdmin does not automatically contact providers, send
household details to an AI service or act on your behalf.

For optional help from an external AI service, prepare an editable prompt from
your saved plan and message. Review and remove private details before copying.
Open your preferred service and paste the prompt yourself. Pasting shares the
text with the chosen service. Review its reply before updating your bill or
message in LifeAdmin. Prompt edits are temporary until copied; they do not
change saved bills, plans or messages.

Export a readable JSON backup to a private location of your choice. Restore
replaces existing records after confirmation. Device and cloud backups depend
on your settings; downloading the app again does not guarantee recovery of bills.

Visit the Tenaciouspl website for examples and support. Review draft messages,
current provider terms and official information before acting. Plans provide
general guidance and do not guarantee savings.

## Listing details

| Field | Value / status |
| --- | --- |
| Brand | Tenaciouspl |
| Publisher | Paul Lonergan trading as Tenaciouspl |
| Apple public seller name | Paul Lonergan; owner approved use of legal name on 18 October 2026 |
| Support contact | tenaciouspl@icloud.com |
| Support / marketing URL | https://tenaciouspl.co.uk |
| App privacy policy | https://tenaciouspl.co.uk/app-privacy.html |
| App identifier | uk.co.tenaciouspl.lifeadmin |
| Initial version | 1.0, build 1 |
| Seller address | Owner deferred review on 18 October 2026; keep address unresolved and do not publish the home address |
| Store accounts / signing | Outstanding |
| Ratings | Complete store questionnaires from the final app |
| Refunds | Applicable rights and store processes; no voluntary 14-day promise approved |

Verify store field limits, price availability and seller requirements in the
relevant console before submission. The trading name does not replace verified
legal identity. Draft copy is not evidence of store approval.

## Screenshots

Use final native screens and invented records: home/search, bill and goal,
saved bill, readable plan/message, saved plans and backup controls. Exclude
account, trial, pricing-tier, checkout and automatic external-AI screens from the
older hosted product. The current native prompt-review screen is optional and
must show invented details with its review and sharing guidance visible.
Startup captures are not a complete store screenshot set.

## Privacy review

Review final signed binaries, dependencies and both store questionnaires:
- Bills/plans use app-private device storage.
- No LifeAdmin sign-in, advertising analytics or automatic external AI upload
  in the native customer build.
- Export and clipboard actions are user initiated; external copies stay under
  the user's control.
- OS backup/device transfer depends on platform settings and package rules.
- Support email and website visits involve separate services and disclosures.
- Store sales/accounting records are separate from household records.
- Deleting a bill deletes associated plans, not external backup copies.

Do not claim a verified store privacy classification before final binary, SDK,
required-reason declarations and questionnaire review.

## Evidence and remaining gates

CI #322 passed at source 0a2e22e14019cd55cff56b6336854fcbf20ab715:
automated tests, backup checks, type checks, Android compilation/storage/package
checks and Apple compilation/install/launch/relaunch. iPhone 11 / iOS 26.5
startup screenshots were reviewed.
https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/38557220882

CI #323 passed Android checks and Apple compilation, but the first simulator
launch timed out before the interactive UI test began. The next run includes
a bounded first-launch wait adjustment and failure diagnostics.
https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/38559775890

Outstanding: interactive persistence/deletion; native JSON export/restore,
cancel and invalid files; upgrade and OS recovery; accessibility and device
coverage; final seller/privacy details, signing, store pricing/screenshots/review.
The owner has no Android device. Physical iPad QA follows the other checks.
Keep PR #2 draft pending explicit final release approval.

## Reviewer notes

No LifeAdmin account or reviewer login is required. Use invented bill details.
LifeAdmin prepares plans and draft messages without accessing bank/provider
accounts or automatically sending messages. Payment is the store's upfront
app purchase; no in-app purchase products form part of this offer.

The optional **Prepare AI prompt** action opens an editable local preview.
Review private details, then use **Copy AI prompt**. External-service links open
without the prompt or household records in the URL. The customer chooses
whether to paste the copied text into a separate service. No external-service
account is required for LifeAdmin's bundled planning, message editing or backups.
Any account or payment requirements of the chosen external service are separate.
Replies are not imported automatically.
