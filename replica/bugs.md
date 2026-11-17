# HomeAdmin Build 4: bug register

Reviewed 2026-11-17 against Build 4 source commit `55a86b53b73e8751a76ed3366a4f7dce6f37d2ce`.

## Confirmed reproduced device bugs
**None recorded during this source-based audit.** The CI passed on simulators, but the reviewer has not independently operated the installed TestFlight build on a physical iPhone/iPad. Do not reclassify a product gap as a reproduced crash or data-loss bug.

## Confirmed configuration and product gaps

| Ref | Priority | Finding | Evidence | Action |
|---|---|---|---|---|
| GAP-01 | P0 | Direct in-app AI disabled in distributed Build 4 | Signing workflow 43965759778: `No in-app AI endpoint configured`. `ai-generation.mjs` requires an HTTPS service origin on native devices. | Decide, privacy-review and securely configure live endpoint before promising automatic AI |
| GAP-02 | P1 | Current comparable provider offers are not independently verified in the reviewed flow | `PlanResultSummary.tsx` labels AI claims; `ComparisonWorksheet.tsx` takes customer-entered offers | Show official provider source, check date, eligibility and total cost; no unsupported savings |
| GAP-03 | P1 | Default AI handoff requires repeated app switching and copy/paste | `BillHelp.tsx` steps 3-4 | Simplify flow and device-test suspended/resumed state |
| GAP-04 | P2 | Result summary depends on AI Markdown heading matches | `PlanResultSummary.tsx` `section()` pattern | Normalize structured output or add tolerant parsing and tests |
| GAP-05 | P2 | Step 1 instructions contradict immediate AI method selection | `BillHelp.tsx` step 1 | Align heading/copy and selection timing |
| GAP-06 | P2 | Calendar syncing only executes with the app running/reopening | `DiaryPanel.tsx` explanatory text and effect | Clarify expectation; verify calendar notification delivery |

## To reproduce on devices, not yet confirmed
- T01: Test first-time user reaching help after adding bill, including focus and scrolling.
- T02: Test combined dual-fuel rates, annual consumption and provider comparisons without guessed savings.
- T03: Test Copilot handoff via iOS app switch and return after several minutes.
- T04: Test generated reply with unexpected headings, no source dates and missing editable email.
- T05: Test change of bill details midway through help and saved-draft conflict handling.
- T06: Test real calendar permission denial and alerts after HomeAdmin is closed.
- T07: Test Build 3 to Build 4 upgrade, backups and restoration on a real device.

For a reproduced bug append: ID, severity (S1 data loss/security/core blocked; S2 feature broken with no workaround; S3 workaround; S4 cosmetic), Build/device/OS, preconditions, numbered steps, expected, actual, screenshot/log, fix commit, retest status.
