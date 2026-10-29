# Reproduced findings

## A11Y-01: primary overview button contrast
- Severity: S3; fixed in draft PR #16 (not yet deployed).
- Baseline: PR #16 local production build.
- Steps: load empty home at 390, 768 or 1024px; run axe-core WCAG AA color-contrast.
- Expected: normal text contrast >=4.5:1.
- Actual: white text on violet-500 reports 4.4:1 for overview Add a bill.
- Evidence: repeated on all three widths; diagnostic `/tmp/ha-a11y-results.json` (transient evidence, finding captured here).
- Proposed fix: darker existing token and explicit focus styling, followed by default/hover/focus validation.

## To check, not reproduced defects
Native calendar permission/alert delivery; live Gemini response quality and availability; unsaved bill edits when changing entry route; installed app backup/reinstall; paid purchase/restore; current public privacy/support pages.

No S1 or S2 defect reproduced in this audit. This is limited to the recorded test coverage, not proof that no critical defects exist.

## Fix verification, 2026-10-28
Primary action changed to existing violet-700 with explicit focus styling. Production build passed. Automated WCAG A/AA scans report no violations at 390/768/1024px with calendar explanation both collapsed and expanded (six scans). This covers empty home only, not every interaction or native assistive technology.
Default home height at 390px is 5090px, reduced from the audit baseline of 5680px. The full navigation refactor remains outstanding.
