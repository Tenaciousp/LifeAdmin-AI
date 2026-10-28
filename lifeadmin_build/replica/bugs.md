# Reproduced findings

## A11Y-01: primary overview button contrast
- Severity: S3; open.
- Baseline: PR #16 local production build.
- Steps: load empty home at 390, 768 or 1024px; run axe-core WCAG AA color-contrast.
- Expected: normal text contrast >=4.5:1.
- Actual: white text on violet-500 reports 4.4:1 for overview Add a bill.
- Evidence: repeated on all three widths; diagnostic `/tmp/ha-a11y-results.json` (transient evidence, finding captured here).
- Proposed fix: darker existing token and explicit focus styling, followed by default/hover/focus validation.

## To check, not reproduced defects
Native calendar permission/alert delivery; live Gemini response quality and availability; unsaved bill edits when changing entry route; installed app backup/reinstall; paid purchase/restore; current public privacy/support pages.

No S1 or S2 defect reproduced in this audit. This is limited to the recorded test coverage, not proof that no critical defects exist.
