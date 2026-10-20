> Branding note, 19 October 2026: the current product is **HomeAdmin**, published by **TenaciousPL**. This document retains historical LifeAdmin names, commands and QA evidence. Use `STORE_SUBMISSION.md` and `BRANDING.md` for current release material.

# Final build bounded QA, 10 October 2026

## Scope and binding limits

Continues the LifeAdmin Background Build and LifeAdmin bounded build work, using issue #3 as the completion tracker. Feature freeze remains in force. No merge, deployment, public forwarding, live payment, production-data exercise, extra service, recurring automation or new charge was performed. Render maintenance and disabled auto-deploy remain release constraints. Physical iPad Safari verification remains the last QA stage.

## Demonstrated failure and correction

At base commit 1115a475c1459ef76697ff5000eef05eb00d85e6, a mobile bill-check goal returned the communications price-negotiation and competition plan. The fallback now chooses separate communications help for bill checking, charge disputes, cancellation/switch information and provider contact. Supplied provider, reference, amounts, date and issue are included where present. Cancellation remains an information request, with explicit review and approval requirements. Price reduction and renewal retain the existing comparison flow.

Browser runtime: clean archive of the base commit plus patched app.py, Git blob b851001ab491330bb0252a77c2f2534c6a7a134b. Fresh disposable storage, private Codespace ports 5173 and 8000, development environment, demo payments disabled, no external AI/payment/DB secrets. Existing modified notes.json, purchases.json and tasks.json were preserved and excluded from this change.

## Verified evidence

- Focused Python regression suite: 3 tests passed. Covers distinct bill/dispute/cancel/contact content, supplied reference and issue, cancellation approval language, and retained savings/renewal comparison.
- git diff --check passed before committing.
- Guest browser bill-check: QA Mobile, QA-BILL-001, current 35, previous 25, fictional unexplained increase. Next steps compare and itemise charges; provider draft retains supplied details.
- Saved bill plan reopened after source task removal and page reload. Continue with AI retained supplied context and four result sections; copied prompt contained QA-BILL-001.
- Result-tab End, Home and ArrowRight navigation selected the expected tabs and panels.
- Task edit during a stopped disposable API retained edited fields and re-enabled submission. Updating succeeded after API restart. A readable error toast was not captured, so error-message quality is not marked passed.
- Price-reduction goal retained alternatives and total-contract-cost comparison. Closing missing-details review preserved the previous result.
- Guest /admin denied access with an admin-sign-in message. Authenticated allowed-admin and nonadmin behavior were not exercised.

Earlier passing CI #244 at the base commit, Docker runtime, owner Drive OAuth and synthetic encrypted offline restore evidence are retained from the tracker. Those gates were not repeated for unchanged code. CI for this correction must be checked at its own pushed head.

## Remaining release gates

- Authenticated browser admin access, denied nonadmin access, filters and retry.
- Browser collection failure/retry with readable errors; full keyboard journey and 200 percent zoom.
- Guest-to-account transition, logout/account switching, two-browser separation and guest-import failure/retry.
- Owner legal identity, domain/support details, security review and backup-key ownership.
- Stripe sandbox checkout, webhook, entitlement and refund lifecycle.
- Independent user testing against the 90 percent unassisted completion target.
- Physical iPad Safari QA last, after earlier release gates pass.

The app is not marked release-ready. Issue #3 remains the authoritative wider tracker, including partial guest-import conflict recovery and non-atomic filesystem deletion cleanup limitations. The intended paid scope is one complete regional-price package, including GBP 1.99 / USD 1.99; obsolete Core-plus-upgrade guidance is not the release scope.

## Subscription context and keyboard continuation: 11 October 2026

A guest cancellation journey was completed using native Tab, Shift+Tab, Enter, arrow keys and keyboard text entry, from the landing page through search/match, detail entry, review, the missing-details dialog, generation and the editable Provider Message tab. Fictional provider QA Streaming Service, reference QA-CANCEL-004 and amount 12 were used. No external message or cancellation was sent. This is one keyboard journey, not full application or 200% zoom acceptance. Clipboard inspection was restricted by browser credential protection and was not bypassed.

The generated named-subscription draft omitted the supplied reference and reason. The bounded repair carries supplied account reference, payment description, issue, minimum-term date and cancellation-confirmation status into next steps and provider wording. Supplied amount, next payment/renewal and billing route also accompany the provider draft. Missing optional values are omitted; no account data is invented. Existing routing and provider-specific cancellation instructions are unchanged.

Three focused semantic regressions passed locally: cancellation reference/reason/billing preservation, dispute amount/date/issue preservation, and absent optional details. Browser regeneration against the patched isolated backend verified QA-CANCEL-004, payment description, cancellation reason, amount 12 and Direct with provider in the editable message. The existing QA store and private ports were retained; original tracked data files were not changed by this work. Saved plans from earlier versions retain their original wording; regenerate deliberately to produce the repaired draft.

Full CI on this change is required before release signoff. Two-account/browser isolation, partial guest imports and deletion, genuine cross-tab focus, authenticated non-admin denial, verified zoom, owner operations/payment gates, independent user validation and final physical iPad Safari QA are still open. No merge, deployment, production data, live Stripe, new charges or recurring automation.

## AI review dialog focus repair: 11 October 2026

Native keyboard testing reproduced a menu-to-dialog focus race: Continue with AI opened the review overlay, but dropdown dismissal returned focus to the page behind it. The result menu now defers its close autofocus to the open AI dialog. The dialog return target is the persistent More result actions button rather than the removed menu item. Existing dialog Tab trapping and Escape handlers are retained.

Browser verification passed: opening through Enter, End, Enter focuses the dialog; Tab reaches the editable prompt; Shift+Tab wraps from the prompt to Close; Tab wraps back to the prompt; Escape closes the overlay and restores More result actions. No external assistant or message was opened. These are specific browser focus checks; complete app accessibility and verified 200% zoom are still pending.

## Account-deletion cleanup failure repair — 11 October 2026

A new disposable SQLite + loopback HTTP fault test reproduced an existing failure: a notes-file write error during unfinished guest cleanup occurred after the account/session had already been erased and closed the HTTP response without a retryable error.

The deletion storage operation now verifies the password, runs the pending guest cleanup callback, then erases the account. A cleanup exception leaves the registered account and session available for retry. The API returns a generic 503 without filesystem details. Deletion-specific reads distinguish absent files from unreadable/malformed stores and validate all stores before cleanup starts, preventing failed reads from being treated as proof of no private records.

Four new HTTP regressions cover write failure followed by successful retry, wrong-password protection, read errors across purchases/tasks/notes, and malformed-store repair followed by deletion. Together with existing account lifecycle and guest-import route tests, 16 focused tests passed locally. The earlier unchanged three account HTTP tests passed before the new fault reproduced the defect. The existing route mock now invokes the verified cleanup callback; no production credentials or records were used.

Limits: JSON files and the account database are not one atomic transaction. A cleanup write can remove some guest records before a later write fails, but the binding and authenticated retry identity remain available. A database commit failure after successful guest cleanup can leave the account present with guest records already removed; the request returns a generic 503. These changes do not establish a complete distributed erasure guarantee or a live PostgreSQL fault test. The real-browser deletion and independent-browser privacy gates remain open, and the prepared QA-user deletion has not been submitted.

Full CI on the new head must pass before signoff. Feature freeze, draft PR, Render maintenance, disabled auto-deploy, preview-only payments, no production backups, no new charges and disabled recurring automation remain unchanged.

