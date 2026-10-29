# Native accessibility follow-up

Date: 2026-10-29. Baseline: PR #16 at 3cebcd1c68b131e00552803d53bc16b3c07d95af. Evidence: HomeAdmin CI run 40789598766, iPhone job 123171219054 and iPad job 123171218464. Full attachments were inspected, rather than relying on the truncated workflow logs.

## A11Y-02: fragmented result-count announcement

Severity: S3. Status: fix prepared; Apple validation pending.

Reproduce: launch the synthetic accessibility fixture with one saved result, scroll to Saved plans and run Apple's accessibility audit. At the saved bill/plan controls stage, Apple reports two small hit areas, each labelled `1`, measuring approximately 8 by 20 or 21 points. iPad reports the same pair again at the saved-plan content stage. The accessibility-tree attachment shows separate text nodes for `Showing`, `1`, `of`, `1` and `saved results.` inside the status region. The screenshot confirms the affected text is the result count, not the Open/Delete buttons.

Expected: the count is a single meaningful status announcement. Actual: React's separate static and dynamic children are exposed as individual fragments by WKWebView.

Change: render the complete count sentence as one string child. Retain role=status, the visible count, filtering, keyboard focus and Apple's strict audit. No accessibility findings are ignored or filtered out. The browser journey also checks the announcement after selecting one matching reply and a bill with no matching results.

## Separate upgrade evidence

The iPhone upgrade job 123171218845 failed during `testPrepareRecordsForAppUpgrade`, before the candidate was installed. The full baseline.log shows the system Done button tapped after entering Additional notes, followed by a timeout waiting for the keyboard to disappear. No candidate upgrade or data-loss conclusion follows from this failure. The same-run iPad upgrade passed. Keep the baseline and candidate checks intact and inspect the next fresh iPhone run; no timeout increase, automatic retry or test exclusion is introduced.

## Validation

Frontend/API type checks, production local build and bundle verification pass. The guided browser journey passes, including matching and empty result-count announcements, saved reply retrieval and save/reload checks. The populated-result accessibility scans at 390/768/1024px with 200% root text and six empty-home accessibility scans report no violations. No live AI service is contacted by these synthetic tests. Apple audit and upgrade results require a fresh CI run. The overall 9/10 gate stays open until native and live-AI evidence is complete.

## Preservation

Existing bills, saved results, backups, local storage format, branding, separate Water/Energy and preferred AI remain unchanged. This iteration addresses a reproduced reliability/accessibility gap identified by Replica's test-first priority, before adding more screens.
