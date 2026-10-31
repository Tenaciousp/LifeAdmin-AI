# HomeAdmin 9/10 acceptance scorecard
Date: 2026-10-31. Baseline: merged main 395162a. Scope: evidence, not a fresh usability test.

## Why the completion estimate fell
The previously quoted approximately 82% and 72% estimates used inconsistent criteria. Neither was measured against a fixed rubric. The later estimate explicitly counted real AI, beginner-device acceptance, commercial release and competitor gaps. Do not infer lost functionality from this change. Retire both as factual completion percentages; use the same evidence gates on every revision.

## Weighted quality rubric (target >= 9/10)
| Dimension | Weight | Evidence required for score >= 9 |
|---|---:|---|
| Beginner ease of use | 25% | Five fresh users complete add bill -> plan/letter/reply -> review/save without assistance; record completion and mistakes |
| Functionality | 25% | All must-have bill, dates, results, export/restore and navigation workflows pass including empty/error/offline states |
| Reliability and accessibility | 20% | Green Linux and Apple CI, real iPhone/iPad accessibility, calendar permission and upgrade/restoration acceptance; no open S1/S2 |
| AI usefulness | 15% | Live synthetic plan/letter/reply/conflict/rate-limit cases, verified consent, no invented prices or auto-send |
| Presentation | 10% | Consistent phone/tablet/desktop screens, 200% text and keyboard tests, readable hierarchy and no redundant entry paths |
| Competitive customer value | 5% | >=80% weighted relevant competitor feature parity, all must-haves complete; exclude bank-linking and partner inventories by decision |

Score each dimension 0-10 ONLY from recorded evidence; weighted total is sum(score * weight / 100). Missing tests are unverified, not automatic zero or a pass. No official score assigned until observations exist.

## Reconciled baseline
- PR #17: all eight CI jobs passed before merge. Render deploy dep-dbj4ba0473hc73b4rjig succeeded with maintenance still on.
- Confirmed browser flows: saved bill drafts, bill-linked actions from dates, 390/768/1024 responsive checks, text zoom, keyboard and saved result filters.
- Local storage, separate Water/Energy, currencies, default chosen Copilot and existing backups preserved.
- No live model answer-quality evaluation; no independent signed-device customer or calendar alert acceptance.
- No verified Stripe live payment/refund or App Store/TestFlight user acceptance. Privacy/terms require final release review.

## Highest-impact next changes, ordered
1. **First-time path measurement before UI rewrite:** measure clicks, confusion and return-from-AI; adjust Home -> Bill -> result navigation only when recordings identify a bottleneck. Use scripted Playwright journeys and independent beginners. Preserve draft/record state.
2. **Live AI evidence gate:** use the six synthetic cases in live-ai-acceptance.md; keep external Copilot as default. Do not enable a billable provider without consent, privacy review and cost limits.
3. **Real-device recovery and accessibility:** installed iPhone/iPad calendar permissions, relaunch, export/restore, interrupted edits, VoiceOver and large type.
4. **Relevant competitive gaps:** visual monthly date view, targeted provider presets, payment/admin distinction, improved personal export recovery; only after core workflow results.
5. **Commercial release:** signed test build, purchase/refund and support/privacy audit before public maintenance exit.

## Work method
Small PR per customer-visible improvement. First define a failing acceptance case, then implement the smallest change, run targeted browser/offline checks, full CI, then human acceptance. No merge/deploy from this scorecard PR. Preserve existing working code and deployment as rollback point.

## Evidence confidence and scope
Replica feature matrix compares publicly described competing functionality, not hands-on tested competitor behaviour. Avoid converting CI green into a 9/10 rating. Update the parity matrix after each change and document what was directly tested.
