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
message in LifeAdmin. Prompt edits are temporary and do not change saved bills, plans or messages.

Export a readable JSON backup to a private location of your choice. Restore
replaces existing records after confirmation. Device and cloud backups depend
on your settings; downloading the app again does not guarantee recovery of bills.

Visit the TenaciousPL website for examples and support. Review draft messages,
current provider terms and official information before acting. Plans provide
general guidance and do not guarantee savings.

## Listing details

| Field | Value / status |
| --- | --- |
| Brand | TenaciousPL |
| Publisher | Paul Lonergan trading as TenaciousPL |
| Apple public seller name | Paul Lonergan; owner approved use of legal name on 18 October 2026 |
| Support contact | tenaciouspl@icloud.com |
| Support / marketing URL | https://tenaciouspl.co.uk |
| App privacy policy | https://tenaciouspl.co.uk/app-privacy.html |
| App identifier | uk.co.tenaciouspl.lifeadmin |
| Initial version | 1.0, build 1 |
| Seller address | Owner deferred review on 18 October 2026; keep address unresolved and do not publish the home address |
| Store accounts / signing | Apple enrolment submitted; verify active membership before signing, TestFlight and signed-device checks |
| Ratings | Complete store questionnaires from the final app |
| Refunds | Owner-approved 14-day full-refund policy; verify store-compatible process and wording before publishing purchase terms |

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

Reviewed application/test source: `5319b671e69c73e9cd6bda3de8a0219dfc36f1c0`.
All six core CI #401 jobs passed: verification, unsigned archive, both full
simulator suites and both different-build upgrade suites. Seven of eight jobs
passed overall; iPad store capture timed out in simulator clock setup before
LifeAdmin launched:
https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39156217928

Downloaded current-run reports and screenshots were reviewed on 18 October.
Both iPhone 11 and iPad (10th generation), iOS 26.2, passed full simulator
acceptance and different-build upgrade checks. Reports confirm original records,
native saves after upgrade and restoration of the older backup. Each full suite
has 31 true boolean report fields including launch acceptance, plus six empty
accessibility-finding reports.
Native invalid-backup cases include duplicate bill IDs, duplicate plan IDs and
orphan plans. The iPad logs show the system Show Keyboard action used successfully.

Limits: simulator evidence does not establish physical-device performance,
manual assistive-technology acceptance, signed store delivery, supported OS
backup/device transfer or every cloud file provider. Upgrade builds use schema 1
and bundle version 1. Interrupted-write coverage is a host-injected hot rollback
journal, not native-process interruption, storage pressure or power loss.

### Signing and release preparation

Apple enrolment has been submitted. Confirm membership is active before
configuring signing and TestFlight. Signed delivery and physical-device tests
have not been completed. Do not purchase additional services automatically.

- Listing and reviewer copy: prepared; validate final console limits and fields.
- Screenshot tooling: CI #402 captures on the required-size targets. iPhone
  capture passed; visual review requires a final open-plan-heading selector fix.
  iPad capture and approval of the complete set remain outstanding.
- Privacy declaration: draft only; finish native live-network/SDK review and
  repeat against the eventual signed package before submitting answers.
- Support/privacy URLs: HTTPS availability and content checked on 18 October.
  Website version 7 is live with TenaciousPL branding and explicit manual-AI
  sharing guidance. This does not establish final signed-package privacy answers.
- Manual accessibility, supported minimum OS, cloud file-provider behaviour,
  device transfer and native interruption/storage-pressure checks remain open.
- Seller name: owner approved Paul Lonergan. Address review remains deferred;
  do not publish the home address.
- The owner has no Android test device. Physical iPad QA follows earlier checks.
- Keep PR #2 draft pending explicit merge/submission/release approval.

### Store screenshot production plan

Use invented records and actual application screens. Existing acceptance captures
are QA evidence, not a finished listing set.

| Order | Screen | Suggested caption | Required visible detail |
| --- | --- | --- | --- |
| 1 | Home and saved bills | List your household bills | Clear bill names and saved state |
| 2 | Saved plan | Build a practical plan | Readable next steps and guidance notice |
| 3 | Message editor | Review every message | Subject/body, Save/Cancel and nothing-sent notice |
| 4 | AI prompt preview | Choose what you share | Editable preview and sharing guidance |
| 5 | Backup controls | Keep a private backup | Export/restore controls and readable-file warning |

Capture targets: iPhone with Dynamic Island, medium display, 1206 × 2622 portrait;
iPad 13-inch, 2048 × 2732 portrait. Verify current accepted dimensions before
upload. Capture the real layout at each target; do not stretch an older tablet
capture to a different aspect ratio. Review labels, clipping, keyboard visibility
and synthetic details in every final image.

Apple screenshot requirements checked 18 October 2026:
https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

### Current unsigned-package privacy review

CI #396 Release archive identity, ARM64 architecture, iOS 16.4 minimum and bundled
local asset configuration were inspected. No remote Capacitor server override,
broad ATS exception, enabled background mode or app file-sharing setting appears
in the packaged configuration. Release file-stage debug strings were absent.
Native clipboard writes are local-only and expire after five minutes; exported
JSON files are readable and remain under the customer's control.

Capacitor and Cordova each include a privacy manifest declaring tracking false
with empty collected-data, tracking-domain and accessed-API arrays. No app-level
manifest is present. These observations do not establish a final App Store
privacy classification or prove absence of every required-reason API.
Capacitor retains networking capability; static review is not live traffic
measurement. Native live-network and final signed-package checks remain open.

## Language roadmap

The initial release is English-only. Keep multilingual support separate from
country expansion. Before adding a language, extract interface and generated
plan/message/prompt wording into bundled translations, retain offline operation,
obtain fluent review and check expanded text, accessibility, dates and numbers.
Localize store and support material where needed. Select the first additional
language using customer evidence. A translated interface does not establish
appropriate guidance for another country's providers or consumer rules.

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
