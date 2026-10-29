# Replica incremental build log

## 2026-10-29: S01 overview, resume saved bill help

Baseline: PR #16 commit 102e0cc07ad1fa8b6ed96a0501818eea99ed2d43. Scope: an incremental returning-user improvement based on the final-draft audit's Home/Continue unfinished work direction. Public competitor research informed concise summaries and actionable organisation; no hands-on competitor resume flow or equivalent feature is claimed.

Implementation: show saved bill-help drafts near the top of the overview, with bill name, output type and saved step. Continue opens the existing guarded workflow. Limit the initial list to three entries, with explicit expand/collapse access to every saved draft. Do not preview provider messages, customer references, draft bodies or prepared AI prompts. Include saved drafts from bills marked done, with an explanation separating admin status from draft progress. Saving a reviewed result clears its draft through the existing storage operation.

Preservation: no new storage fields, migrations, dependencies, branding, AI-service choice or sharing rules. Existing bill, date, saved-result, diary and backup routes stay available. Unsaved-message/workflow guards remain in the existing onHelp handler.

Tests: 80 offline tests and frontend/API type checks pass. Production local build and bundle verification pass. The synthetic browser journey passes, including resume after reload, an unchanged prepared AI request, no private-content preview, draft removal after saving a reviewed result, access to the fourth saved draft, and persistence of four drafts after another reload. Saved-help and saved-result regions have no automated WCAG violations at 390/768/1024px with 200% root text; six empty-home accessibility scans pass. The phone saved-help screenshot was visually inspected. The journey checks overview resume after reload without losing the prepared request, no preview of private content, removal after saving a reviewed result, expansion to a fourth draft and persistence after another reload. The saved-help region is scanned at phone/tablet widths with 200% root text. Live AI and native acceptance are separate.

Delivery: keep this change on a separate branch based on PR #16 while its Apple accessibility/upgrade CI runs. Do not move PR #16's head or interrupt its checks. PR #17 will target main for full combined-candidate CI. Merge #16 first, then reassess #17 against the updated main before merging. No deployment is included.

Remaining: dedicated task views, a consistent AI workspace, live AI quality, beginner usability and installed-device acceptance. Overall 9/10 quality is not established by this increment.


## 2026-10-29: S02 bill entry, returning-user focus

Baseline: follow-on draft #17 at 6e04dffef5bf0bb5c592e6b1e8edac9061a0f179. PR #16's head 102e0cc passed all eight CI jobs in run 40846513916 and is ready for review. This iteration follows the Replica audit's recommendation to keep entry out of the way when consulting saved work.

Implementation: expand bill entry on first use; collapse after an acknowledged save and on loading existing bills. Add, Edit and service suggestions open the form and focus its heading. Hiding the form retains in-memory values and exposes a Continue unsaved bill action. Replacing meaningful unsaved details requires confirmation; clearing affects only the entry, never stored bills. Cancel edit returns focus to the persistent entry control. The collapsed copy explains the save-before-reload limit. Find a bill or provider remains available for the existing suggested-entry route.

Preservation: existing local records, storage schema, backup formats, branding, categories, AI preference/consent and guarded help/result routes. No new dependency or deployment. This is progressive disclosure, not a completed multi-screen navigation redesign.

Validation: type checks pass. Production local build/bundle checks, 80 offline tests and both expanded browser journeys pass. The returning-user page passes a full-page automated WCAG scan with entry collapsed. Open entry passes eight WCAG scans at 320/390/768/1024px with 100%/200% root text, without horizontal overflow; the phone entry screenshot was visually inspected. Six empty-home scans and the keyboard/layout journey also pass. Hiding/reopening retains values, cancellation preserves unsaved data, confirmed clearing leaves the saved bill accessible, and existing editing/reload/AI-help flows pass. Add also starts a blank bill after an unchanged existing editor was hidden, while the replacement guard protects unsaved edits. Native CI must run against the complete follow-on draft, separately from #16's successful head.


## 2026-10-29: AI recovery and native preview gesture

Baseline #17 at 5d01f939. Add direct chosen-AI and offline recovery from the in-app generation screen, preserving request context and resetting consent. 80 offline tests, type checks, production build/bundle and the expanded synthetic browser journey pass, including HTTP 429 recovery and accessibility at 100%/200% text. Move bounded native reveal drags to the gutter after the store-preview failure screenshot showed text selection. The native change requires fresh Apple CI. The user now authorises validated deployment/live AI integration; update the published privacy disclosure and verify real provider responses before claiming readiness or 9/10 quality. Details: ai-recovery-and-preview.md.
