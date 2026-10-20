# HomeAdmin store submission pack

Updated 20 October 2026. This pack supersedes earlier account-based web release plans.

Current branding: **HomeAdmin**, by **TenaciousPL**. The Account Holder confirmed the name saved successfully in the existing Apple record on 19 October. The approved logo master is `branding/homeadmin-logo.png`; see `BRANDING.md`. New app screenshots must be captured from the renamed build. Earlier screenshots and reports retain their original names as historical evidence and are not the final listing artwork.

## Agreed offer

HomeAdmin is a paid download: £1.99 in the UK, with store-managed local equivalents.
All planning features shipped in this release are included. No trial, subscription,
HomeAdmin account, sign-in, in-app checkout or separate upgrade. Prices belong in
the store and promotional website, not inside the app. Separate future products
are outside this purchase promise. Store price configuration still needs verification.

## Listing copy

App name: **HomeAdmin**
Apple subtitle currently saved: **By TenaciousPL**
Google short description: **Manage household bills in one place. List, plan and save.**
Strapline: **List, plan and save.**
Keywords: bills,household,renewals,subscriptions,planner,budget,energy,insurance,cancellation

### Full description

Keep household bills and practical next steps together with HomeAdmin.

Search for a bill or provider, choose your goal and add the details you know.
Build a clear plan for reviewing a bill, preparing for renewal, considering a
switch, cancelling a service, querying a charge or contacting a provider.

HomeAdmin includes 12 household categories and seven goals, with planning styles
for different situations. Save bills and plans, update bill status, reopen saved
plans and copy draft messages when you are ready to act.

Household records stay in the app's storage on your device. No HomeAdmin account,
bank connection or mailbox access is required. Planning uses bundled guidance
and works offline. HomeAdmin does not automatically contact providers, send
household details to an AI service or act on your behalf.

For optional help from an external AI service, prepare an editable prompt from
your saved plan and message. Review and remove private details before copying.
Open your preferred service and paste the prompt yourself. Pasting shares the
text with the chosen service. Review its reply before updating your bill or
message in HomeAdmin. Prompt edits are temporary and do not change saved bills, plans or messages.

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
| Store accounts / signing | Apple membership active, Team ID C8T85FCR6R; all three credentials saved in protected GitHub environment apple-signing; signed build and TestFlight delivery outstanding |
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
- No HomeAdmin sign-in, advertising analytics or automatic external AI upload
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

### Current checkpoint: 20 October 2026

PR #2 is merged at `ddeb463c6ba75e7158ad0e0ae20907fc3f29a286` with owner
approval. CI #414 passed all eight jobs before merge. Downloaded full-simulator,
different-build upgrade and store-preview artifacts were reviewed on 20 October;
their archive hashes match GitHub metadata. Both full journeys passed with zero
kernel capture drops. Each retained packet file contains only the synthetic
control packets, within the limited process-attribution scope described below.
Both upgrade reports preserve exact records, accept subsequent saves and restore
older backups. All ten screenshot dimensions and hashes match their manifests.

Fresh main CI #415 initially passed seven jobs. Its iPhone upgrade failed while
the unchanged older baseline waited 60 seconds for Search on a blank WebView,
before preparing records or installing the candidate. The preserved screenshot
and startup log were inspected; the root cause is not established. One unchanged
retry was accepted as attempt 2 and was still queued at this checkpoint. No
timeout, historical baseline or acceptance assertion was changed. CI #416 for
signing PR #4 is also pending. Keep signing gated on successful full CI for the
final main commit; a successful earlier PR run does not replace that requirement.

The owner approved merging signing PR #4 after checks pass and making the first
signed build. Its IPA/evidence will be retained for seven days in this public
repository, explicitly approved. Apple upload, TestFlight distribution and
release are separate later actions. App Store Connect showed No Builds on
20 October; build 1 is planned, subject to checking intervening uploads/dispatches.

App Store draft fields saved: description, keywords, support/marketing website
links and reviewer notes. The owner supplied review contact details directly.
Reviewer sign-in is disabled and manual release selected. Primary category is
Productivity; the saved privacy-policy URL is
https://tenaciouspl.co.uk/app-privacy.html. No privacy questionnaire answers were
published. Age ratings, final screenshot gallery, copyright, pricing/agreements,
trader/address review and physical-device/signed-package acceptance remain open.

Screenshot composition improvements are isolated on `qa/store-gallery-followup`
at `27e4aa11ee158f589cf18a42be63c827a30c3f97`. They add genuine saved-bill and
prepared-AI-question capture scenes. Focused local extractor tests pass; native
execution and visual review of the revised captures are pending. Customer app
code and the approved signing branch are unchanged by those capture-only edits.

### Historical checkpoint: 19 October 2026

Reviewed application/test source: `4a16999f2017ef77bb6b063651556a2e58e27259`.
Tested merge: `00a4da507192b3d29d30f591e0a5d391a5963bc3`.
All eight CI #405 jobs passed: verification, unsigned archive, both full
simulator suites, both different-build upgrade suites and both store-capture jobs:
https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39218439724

Reports and screenshots were downloaded and reviewed on 19 October. Each full
suite has 31 true boolean report fields and six empty sampled accessibility
reports. Both upgrades preserve one exact synthetic bill and plan, accept new
saves and restore the older backup. Candidate package fingerprint:
`d9de83ad26afb42b500e3fbf1b3bf4d358580402619e64ab991f341301cf9a9c`.

Full acceptance used iPhone 11 and iPad (10th generation), iOS 26.2.
Required-size captures used iPhone 16 Pro and iPad Pro (12.9-inch, 6th generation):
five original images per device. PNG dimensions and hashes match the manifests.
Date controls fit their columns; open-plan heading selection and single-line
title checks passed. Tablet message/AI/backup captures include preceding content
at the page scroll limit. Final listing selection and presentation remain open.

The earlier #404 iPad suite timed out during repeated XCTest animation-idle waits.
#405 passed within the same limits without an app-code workaround or automatic
retry. This does not establish the cause of the earlier runner variability.

Limits: simulator evidence does not establish physical-device performance,
manual assistive-technology acceptance, signed store delivery, supported OS
backup/device transfer or every cloud file provider. Upgrade builds use schema 1
and bundle version 1. Interrupted-write coverage is a host-injected hot rollback
journal, not native-process interruption, storage pressure or power loss.

### Signing and release preparation

Apple membership is active and the existing app record is named HomeAdmin.
The distribution identity/profile are prepared and the three signing secrets
are saved in the protected `apple-signing` environment. Signing PR #4 awaits
successful checks and merge. Signed delivery and physical-device tests have not
been completed. Do not purchase additional services automatically.

- Listing and reviewer copy: saved in the Apple version-1.0 draft. Review contact
  details were supplied by the owner; manual release and no reviewer sign-in are saved.
- Screenshot tooling: both #414 capture jobs passed and all ten original images
  were reviewed. Improved capture scenes await native validation; final gallery remains open.
- Privacy declaration: not completed or published; finish native live-network/SDK review and
  repeat against the eventual signed package before submitting answers.
- Support/privacy URLs: HTTPS availability and content checked on 18 October.
  Website version 14 is live with HomeAdmin/TenaciousPL branding, optional-calendar
  disclosures and manual-AI sharing guidance. Its privacy-policy URL is saved in
  App Store Connect. This does not establish final signed-package privacy answers.
- Manual accessibility, supported minimum OS, cloud file-provider behaviour,
  device transfer and native interruption/storage-pressure checks remain open.
- Seller name: owner approved Paul Lonergan. Address review remains deferred;
  do not publish the home address.
- The owner has no Android test device. Physical iPad QA follows earlier checks.
- PR #2 is merged with owner approval. Signing PR #4 remains gated on CI.
  App Store submission and release still require separate owner approval.

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

### Native network measurement

The #405 Release archive was inspected on 19 October. No remote CSS/font URLs,
hosted customer API endpoints, broad ATS exception or remote Capacitor server
override were found. External content URLs in the local app are support/privacy
and the five explicit AI-service links. React error URLs and XML/SVG namespace
strings also occur in bundled framework code; these are not evidence of requests.

Bundled fetch implementations include Capacitor HTTP support and module preloading.
Capacitor 8.5.3's native HTTP handler creates URLSession tasks in response to
plugin calls. Capability presence does not establish use or absence of traffic.
Its empty privacy manifest was compared with the pinned SDK source. No additional
required-reason codes were inferred from generic plugin recommendations.

The full simulator suites now run inside a macOS packet-metadata capture wrapper.
It listens across interfaces but applies a packet-metadata filter before output:
only process App, effective process App, or the synthetic control process PID.
Unrelated runner/OS packet metadata is excluded. It saves process names/PIDs and
direction, no packet payload file, and uses a synthetic loopback UDP control
packet to verify capture.
Missing control traffic, early capture termination or dropped packets fail the
capture check. Existing native assertions and time limits are unchanged.

Artifacts: network-packets.txt, network-capture.log and network-capture.json
inside the usual Apple launch evidence. CI execution and manual attribution of
App/WebKit traffic are pending. WebKit traffic without App effective-process attribution is outside this capture;
review attribution and use broader targeted Instruments checks before final sign-off. Successful capture is not a zero-network result, a signed
binary review or a final privacy declaration.

References:
- https://developer.apple.com/documentation/network/recording-a-packet-trace
- https://github.com/apple-oss-distributions/tcpdump/blob/main/tcpdump/tcpdump.1
- https://github.com/ionic-team/capacitor/blob/8.5.3/ios/Capacitor/Capacitor/Plugins/HttpRequestHandler.swift

## Language roadmap

The initial release is English-only. Keep multilingual support separate from
country expansion. Before adding a language, extract interface and generated
plan/message/prompt wording into bundled translations, retain offline operation,
obtain fluent review and check expanded text, accessibility, dates and numbers.
Localize store and support material where needed. Select the first additional
language using customer evidence. A translated interface does not establish
appropriate guidance for another country's providers or consumer rules.

## Reviewer notes

No HomeAdmin account or reviewer login is required. Use invented bill details.
HomeAdmin prepares plans and draft messages without accessing bank/provider
accounts or automatically sending messages. Payment is the store's upfront
app purchase; no in-app purchase products form part of this offer.

The optional **Prepare AI prompt** action opens an editable local preview.
Review private details, then use **Copy AI prompt**. External-service links open
without the prompt or household records in the URL. The customer chooses
whether to paste the copied text into a separate service. No external-service
account is required for HomeAdmin's bundled planning, message editing or backups.
Any account or payment requirements of the chosen external service are separate.
Replies are not imported automatically.
