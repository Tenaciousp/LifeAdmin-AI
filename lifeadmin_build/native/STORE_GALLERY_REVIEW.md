# HomeAdmin store gallery review

Reviewed 20 October 2026. This is a candidate-gallery review, not approval for store upload.

## Evidence

- CI run: https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39414642805
- Artifact ID: 12263180154, iPhone store previews.
- Source tested: `1a51786322c1fefc0b73d63cd86e66c13c10d703`, the PR #5 merge candidate before the later framing adjustment.
- Device/runtime: iPhone 16 Pro simulator, iOS 26.2.
- Seven PNGs: each 1206 by 2622 pixels. Each SHA-256 matched the artifact manifest.
- Records are synthetic. The visible DEMO-2401 reference in plan/message examples is invented.

## Visual findings

| Scene | Observation | Disposition |
| --- | --- | --- |
| 01 home | HomeAdmin identity, household-bill heading and offline/account-free copy are readable. The form continues below the viewport. | Candidate introductory image. |
| 01b bills | Saved Streaming subscription and the complete Create plan, Edit, Mark done and Delete bill controls are visible. | Addresses the missing saved-bill view. |
| 02 plan | Saved-plan heading and guidance are readable. Longer guidance continues below the viewport. | Candidate; full plan cannot fit in one genuine viewport. |
| 03 message | Message editor, Save and Cancel controls are visible. The long subject continues inside its field. Copy and AI preparation controls are visibly disabled while editing. | Candidate editor view; do not describe disabled controls as available in this state. |
| 04 ai-review | Preferred service, selected task and detail selection are visible. Account reference checkbox is unchecked. Remaining selections continue below the viewport. | Candidate detail-review view. |
| 04b ai-prompt | Prepared question, Copy AI prompt, Open ChatGPT and Close AI prompt controls are visible. The question uses an internally scrollable text area. | Addresses the missing question and handoff view. |
| 05 backups | Backup explanation, Export, Restore, Delete and support controls are readable. The bottom of the calendar section appears above the backup section. | Further composition review required; avoid claiming a clean isolated backup frame. |

No keyboard obscures these captures. Visible purple buttons and HomeAdmin branding are consistent across the set. This review does not establish accessibility contrast compliance or physical-device rendering.

## Still open

- CI #418 contains the later 32-point top-inset change. Review its fresh iPhone and iPad images; this evidence does not validate that revision.
- PR #5's original iPad gallery failed the full-heading visibility assertion. Review the repair result before selecting iPad images.
- Final gallery order, selection and any presentation framing remain owner-review items. Preserve genuine app content and distinguish internal text-area scrolling from missing controls.
- No images have been uploaded to App Store Connect by this review.

## Revised iPad gallery: CI #418

Reviewed 20 October 2026 after the 32-point top-inset change. Run: https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39438316829. Artifact ID 12275313498; tested merge source `865fb2893894c1acd3eaeda4f81a8839d376651d`.

All seven native PNGs match the manifest dimensions (2048 by 2732) and SHA-256 hashes. Device/runtime: iPad Pro (12.9-inch, 6th generation), iOS 26.2. Both store-preview jobs passed. The iPad plan heading is now fully visible; its native full-visibility assertion passed and the complete plan image was visually inspected. This resolves the observed clipped-heading capture failure for this run.

The seven-image overview shows the saved bill, message editor, detail-review and AI-question/handoff views. No keyboard obscures the captured screens. Larger tablet viewports include neighbouring sections in several images, especially backup and AI-question scenes; final selection/composition remains open. Captured question text has its own scrollable area.

This result validates the screenshot repair on the tested source, not the full CI run. CI #418 has separate Android dependency-download and iPad baseline-upgrade failures. It does not clear signing, device acceptance or store upload.
