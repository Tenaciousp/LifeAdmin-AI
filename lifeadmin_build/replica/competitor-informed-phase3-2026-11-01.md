# Competitor-inspired improvements, 2026-11-01

## Evidence and limits
This is a limited public-feature comparison, not a logged-in walkthrough or a claim of live user acceptance. Previously reviewed Bobby, Bills Monitor, Snoop and Rocket Money product descriptions are the reference points. Revalidate exact competing features and prices before sales claims.

| Public pattern | HomeAdmin position | Decision |
|---|---|---|
| Bobby recurring bills and cost overview | Currency-separated monthly and annual estimates already exist | Keep; avoid conversion guesses |
| Bills Monitor renewal/date awareness | Dates and bill-linked help already exist; no monthly grid | Add direct action in empty date state now; month grid in separate PR |
| Snoop reminders and timely actions | Manual dates and AI guidance, no bank-linking | Preserve manual, local-first reminders; defer bank-derived insights |
| Rocket Money subscription review | Saved bills with recurring costs and guided next steps | Preserve private manual tracking; no unapproved cancellation or partner sales |
| Common provider/service templates | Bill category shortcuts already exist | Add only tested, useful local provider presets later |
| Clear AI action steps | Copilot-first external AI path | Add explicit review/copy/return guidance in this PR |

## Changes queued in PR #20
- Introductory three-action guide and no-auto-sharing reassurance at the beginning of bill help.
- Direct Add a bill with a date action in an empty upcoming-dates section.
- Synthetic browser assertions for both pieces.
- No login, payment, migration, new third-party charges, data sharing or deployment changes.

## Deferred and separate acceptance gates
- Monthly calendar grouping and date navigation with timezone and accessibility tests.
- Provider presets with international coverage and no misleading autocomplete.
- Payment history distinct from marking an admin task complete.
- Backup recovery on physical devices.
- Six live AI output checks and five independent beginner journeys.
These are not implemented by this PR, and no competitive parity increase is claimed.
