# HomeAdmin final-draft audit
Date: 2026-10-28. Target: overall app quality >=9/10 against comparable store products. Scope: the local offline/native-facing customer UI including PR #16 overview changes, code paths, automated web/API checks and browser rendering. This is not installed-device acceptance or live-AI validation.
## Baseline and preservation
Preserve merged PR #15 (d50810a), existing PR #16, all local work, HomeAdmin/TenaciousPL branding, separate Water/Energy, local bills/results, backups, currency separation and default preferred Copilot. No app source, deployment, credentials or storage formats were changed during this audit.
## Evidence
- 78 offline Node tests passed.
- 317 Python/API tests passed; these include hosted web/server paths and do not all apply to the native product.
- Frontend/API type checks passed.
- qa_bill_experience.cjs passed: international water entry, forecast, search, save/reload and 390/768/1024px layouts.
- qa_bill_help.cjs passed: chosen-AI plan/reply journeys with synthetic answers, privacy exclusions, review reset, separate saved results, offline template, sources, progress, follow-up persistence and six-date expansion/direct help.
- check_local_layout.cjs passed: 320/375/768/1024px, 100%/200% text, keyboard traversal and external-service links.
- axe-core WCAG 2 A/AA and 2.1 AA scan: one color-contrast rule violation at each of 390/768/1024px in the EMPTY HOME state. This is not a full-app accessibility certification.
- Empty page measured 5680px high at 390px width, 4148px at 768px, 3812px at 1024px (844px viewport height). No horizontal overflow or broken section anchors at these sizes.
- Four visible Add a bill buttons on empty home. Fifteen h1/h2/h3 headings, including empty-state titles.
- One 20px checkbox was flagged by a simple control-box measurement. Its larger label is clickable; target size is not a confirmed failure.
## Functional ledger
|Function|Evidence/state|Final-draft implication|
|---|---|---|
|Entry/categories/search|Synthetic browser and offline tests pass|Retain; combine search/presets/manual entry into one clear Add route|
|Water/Energy and international facts|Relevant field selection and currency tests pass|Retain; language of AI output is not full-interface localisation|
|Recurring totals|Tests pass for known periods, currencies and invalid inputs|Keep separate currencies; clearly label estimates and excluded bills|
|Dates and follow-up|Persistence and six-date browser checks pass|Retain full-list access; separate past dates from upcoming action priority|
|Guided plans/letters/replies|Sample journeys pass|Keep bill linkage and review gate; replace repeated prompt editors with one consistent workspace|
|Direct Gemini generation|Mock/error tests and readiness handling pass|Live credentials/model/service and installed-app return path still unverified|
|Current provider alternatives|Prompt asks for dated sources; generation proxy has no search tool configured|Do not label outputs live comparisons; verify availability/prices separately|
|Saved results/edit/copy|Synthetic persistence, privacy and safe-link checks pass|Differentiate Plans, Letters and Replies visually and in labels|
|Completion|Current task status marks admin work complete|Do not represent this as a payment record; payment history requires its own model|
|Calendar|Diary logic and tests; native plugin exists|Permission denial, alert delivery, duplicate-device entries and recovery still need installed-device testing|
|Backups|Storage/restore tests and prior Apple upgrade checks|Retain; export is readable personal data, not end-to-end encrypted automatic cloud recovery|
|Delete/retry/error states|Automated storage/API cases pass|Native reinstall, device loss and real interrupted writes remain acceptance tasks|
|Support/privacy|Links and text exist|Inspect published content against live AI data flow before enabling; no legal/content approval claimed|
|Purchase/TestFlight|Outside this browser audit|Verify actual purchase/restore, signed build, background/relaunch and iPad/iPhone acceptance separately|
## Confirmed bug
A11Y-01, S3: overview hero Add a bill button uses white text over violet-500. axe reports contrast 4.4:1 vs required 4.5:1 at normal text size. Reproduce by loading empty home and scanning color-contrast. Fix: darker existing violet token and visible focus treatment; rerun scans in default/hover/focus states. No code change applied in this review.
## Product and page-setup findings
These are observed layout or design judgements, not failures in storage or generation:
1. One long document contains overview, provider search, entry form, help, lists, selected result, diary and backups. The top navigation consists of anchor jumps rather than separate task views.
2. Two introductory headings repeat the product promise. Several empty states repeat entry prompts instead of providing one first-run route.
3. Main form is visible even when someone only wants to consult saved bills. Selected results can be far below the form.
4. Reminders and backup cautions occupy substantial space on empty home. Essential disclosure should remain available near the relevant action, with explanatory detail progressively revealed.
5. AI concepts split between Create a plan or message, Prepare AI prompt, external service selection, offline settings and saved-result editing. This increases learning effort.
6. The detailed Plan focus list includes specialist choices such as small landlord and travel. Keep specialist modes out of the primary household route.
7. Draft state is implicit. Users need a visible distinction between draft ready, waiting for provider and resolved, independently of paid/unpaid.
## Proposed final information architecture
Home: recurring total by currency, next actionable dates, one Add bill primary action, Continue unfinished work; short first-run explanation.
Bills: searchable/filterable list, cost/cycle/next date, bill-detail view.
Bill detail: Summary, Dates, Plans/messages; Edit and Create plan/message primary actions; scoped follow-up.
Plans & messages: type/status filters, readable detail, editable message, source links and copy/export; no implication a copied message was sent.
Diary: future/past timeline, permission/setup status and explicit calendar scope. Payment dates must not be conflated with current contract-only sync.
Settings: preferred AI, privacy/data sharing, calendar setup, backups, support and accessibility controls.
Prefer an adaptive navigation model for phone/tablet; prototype before restructuring. Preserve current data contracts and guided work in progress.
## Priorities for the final draft
P0: resolve confirmed contrast failure; verify live Gemini on synthetic bill facts, including missing/conflicting data, unavailable service and rate limits.
P0: preserve save/reload/restore and ensure every primary path has loading, error, empty and recovery states after any navigation refactor.
P1: separate the long document into task views; remove repeated hero/empty prompts; keep existing functional behaviours.
P1: one reusable AI workspace: confirm facts -> choose outcome -> draft/answer -> check -> save -> next action.
P1: structured result sections for actions, alternatives, facts to confirm and message; links, dates and costs visible without interpreting long prose.
P1: actual beginner and installed-device evaluation of the complete product.
P2: recurring-cost ranking/categories, month view, presets, document import and personal-cloud recovery after core flow validation.
## Competitor influence and boundaries
Bobby: concise fixed-cost/subscription overview (https://www.bobbyapp.co/).
Snoop: timely insights and next steps (https://www.snoop.app/how-it-works/).
Bills Monitor: calendar/payment tracking (https://apps.apple.com/gb/app/bills-monitor-pro-for-ipad/id599194158).
Android Subby: private manual tracking, published import/personal-backup features (https://play.google.com/store/apps/details?id=com.slapp.subby).
These are public descriptions, not observed installed competitor journeys. No meaningful coded review sample, tap-count comparison, competitor visual diff or claim of superior quality is established.
## Overall quality decision
Engineering checks provide strong evidence for tested paths. Page structure, consistency of AI interaction, live answer quality and installed-device usability remain below the evidence needed for 9/10 acceptance.
Do not assign a numerical overall score until all six agreed categories have evidence. Weights: presentation 20%, ease 20%, functionality 20%, AI usefulness 20%, reliability/accessibility 15%, value 5%. Track gaps openly. Store stars and parity scores are separate metrics.
