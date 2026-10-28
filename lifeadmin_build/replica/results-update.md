# Saved-result retrieval improvement

Review date: 2026-10-28. Baseline: PR #16 head 6815f03a1c8d846a1bea6f8dd069f282bf9c69de, following merged PR #15. Existing working-tree changes are retained.

## Research-to-build decision

The public competitor review recorded Bobby's concise tracking, Bills Monitor's bill/date organisation, Snoop's actionable guidance and Android Subby's manual private records. Those are published capabilities, not verified competitor interaction flows. Sources and limitations remain in recon.md and final-draft-audit.md.

The HomeAdmin audit identified an actionable gap in its own saved results: letters, replies and plans shared an undifferentiated list, with no bill or result-type filter. This iteration applies the general pattern of clear organisation to HomeAdmin's distinct bill-specific guidance. It does not claim competitors provide the same AI workflow.

## Implementation

- Result cards show Plan, Letter or Reply, their linked bill/provider, saved date and preparation source. Older results without an output type remain Plans, retaining access to offline templates and restored records.
- Search titles, message subjects, bill names and providers. Combine a bill filter and result-type filter; show the matching count and a clear-filter recovery action.
- List newest results first without changing stored record order. Opening, editing, copying and deleting continue through existing handlers and unsaved-message guards.
- A bill with results has a direct View saved results action. It scopes the list to that bill and moves keyboard focus to the results heading, without discarding guided work in progress.
- Bill searches with no matches explain the state and offer Show all bills.
- Keep the existing Saved plans heading and legacy plan controls for compatibility with native acceptance paths. Result type labels clarify letters and replies.
- CI uses the existing locked developer QA dependency package and runs home accessibility checks, plus populated-result accessibility checks within the guided journey.

## Preservation

No storage schema, bill values, backup formats, branding, Water/Energy separation, currency calculation, AI preference or runtime AI service is changed. No competitor code, copy or assets are used. No bank connection or HomeAdmin account is introduced. No merge or deployment is included.

## Validation and remaining work

Frontend/API type checks, 80 offline tests, production local build and bundle checks pass. Bill-entry and guided-help browser journeys pass, including combined result filters, bill linkage/focus, opening the saved reply, empty-search recovery and six bills/three results surviving reload. The result section has no automated WCAG violations at 390/768/1024px with 200% root text. Six empty-home accessibility scans pass. Keyboard/layout checks pass at 320/375/768/1024px with 100%/200% root text, no clipped controls or horizontal overflow, and no browser page errors. The phone result screenshot was visually inspected. These are browser checks, not native assistive-technology acceptance or live AI answer validation.

Previous-head CI: seven jobs passed; iPad simulator message-edit acceptance exceeded its 15-minute allowance while XCTest repeatedly waited for app idleness. This is unresolved native evidence, not a waived check. The updated head requires fresh CI.

The overall 9/10 target still needs task-view navigation, live AI answer evaluation, installed-device testing and beginner usability evidence. This iteration improves result retrieval; it does not establish the overall score.
