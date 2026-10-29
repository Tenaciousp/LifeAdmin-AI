# HomeAdmin competitor review
Date: 2026-10-28. Scope: bill overview, entry, reminders, guided assistance and saving results on phone/tablet. Baseline: merged PR #15, d50810a909f14f69d4c110a0ee5a71b5e3269d82. Existing working-tree changes are preserved.
## Evidence and limits
This is a public-listing and source-code review, not hands-on testing of competitor apps. Competitor state transitions, screen counts and tap counts are unverified. No proprietary code or assets were accessed. No statistically useful review sample has been coded; no complaint frequencies or popularity-based quality scores are claimed.
|Product|Public source|Published strength|HomeAdmin response|
|---|---|---|---|
|Bobby|https://apps.apple.com/gb/app/bobby-track-subscriptions/id1059152023|Subscription presets, clear fixed-cost overview, upcoming bills|Retain existing categories and currency-separated recurring totals; assess preset-assisted entry next|
|Bills Monitor|https://apps.apple.com/gb/app/bills-monitor-pro-for-ipad/id599194158|Calendar, recurring bills, reminders, partial payments|Improve date visibility now; payment history and calendar month view remain gaps|
|Snoop|https://apps.apple.com/gb/app/budget-planner-l-snoop-money/id1495077102|Automatic categorisation, timely bill insights and switching support|Connect dates to guided help; live bank feeds and partner offers are outside current local-data scope|
|Subby (Android, Pocket Implementation)|https://play.google.com/store/apps/details?id=com.slapp.subby|Manual private tracking, renewal reminders; screenshot import and personal Drive backup advertised|Preserve no-account local records; document import and managed personal backup remain future work|
The similarly named iOS Subby by another developer is not treated as the same product.
## Preserve
Retain HomeAdmin/TenaciousPL branding, bill categories including separate Water/Energy, local storage and backup compatibility, currency separation, reviewed saved plans/messages, preferred external AI with Copilot default, explicit sharing consent and service availability checks. No rebranding, deployment, data migration or banking connection is included in this change. Live Gemini validation and signed TestFlight release remain separate unresolved work.
## HomeAdmin screen/flow map from code
S01 overview: recurring totals and dates; empty/filled states implemented.
S02 bill form: categories, individual bill types, relevant fields and optional dates.
S03 guided help: choose output, confirm facts, ask AI, review/save.
S04 saved results: sources, edit/copy message, include saved result in AI review and follow-up links.
S05 diary/backups: calendar permission workflow and explicit local export/restore.
F01 add bill -> guided help -> reviewed result. F02 overview date -> edit bill; this change adds overview date -> guided help. F03 view first five dates -> expand all -> collapse. F04 reopen bill/result after save and restore. Competitor equivalents are inferred from published capability descriptions, not observed journeys.
## First implementation
1. Make all entered dates reachable. The prior overview silently rendered only the earliest five; add an explicit expand/collapse control with an accessible expanded state.
2. Add a guided plan/message button alongside each dated bill, retaining edit access and meaningful accessible names for repeated controls.
3. Extend the synthetic browser journey to six dated bills: expand, reach the last bill's help, close and collapse.
Existing date ordering, totals and storage structures are unchanged.
## Prioritised next improvements
P1 verify direct in-app generation end-to-end using synthetic household examples, including missing/conflicting facts and unavailable service recovery.
P1 assess actual beginner completion and visual quality on installed iPhone/iPad builds.
P2 expose a ranked list of recurring costs within each currency and category, without implying verified savings.
P2 simplify entry with clearly labelled optional service presets; avoid assumed provider prices.
P2 evaluate a calendar overview and independent payment history; completed admin work must not silently mean a bill was paid.
P3 document/screenshot import with confirmation, plus recovery through users' own storage. These require separate privacy and native-device testing.
## Overall 9/10 gate
Score presentation 20%, ease of use 20%, functionality 20%, AI usefulness 20%, reliability/accessibility 15%, competitive value 5%, using evidence for each. Overall target >=9/10 and no unresolved critical defects. Unassessed areas stay unscored; feature parity and store stars are not overall app quality. No 9/10 claim is established by this patch.
## Validation
78 offline tests and frontend/API type checks pass for the first implementation. Production build and expanded browser/Apple checks are pending at draft creation. Sample AI answers validate workflow only. No live provider offer or competitor account test is claimed.
