> Branding note, 19 October 2026: the current product is **HomeAdmin**, published by **TenaciousPL**. This document retains historical LifeAdmin names, commands and QA evidence. Use `STORE_SUBMISSION.md` and `BRANDING.md` for current release material.

# LifeAdmin supported-browser QA runbook

Updated: 12 October 2026  
Target branch: `dev/energy-renewal-plan`  
Current tested application revision: `5a633a5070e74f9a2abc8372c61c43190206ff9b`

Use only synthetic data and sandbox payments. Record tested application commit, browser/version, viewport and observed result before marking a check passed. Use approved secure credential entry only; never expose passwords, keys or tokens in screenshots, model-visible controls or repository records. Browser emulation is not physical-device evidence.

## Environment and evidence record

| Evidence | Recorded value |
|---|---|
| Private frontend | Existing Codespace, port 5173, Private |
| Private API | Existing Codespace, port 8000, Private |
| Paid-access setting | `PAID_ACCESS_REQUIRED=true` for the 11 October browser session |
| Tested application | `5a633a5070e74f9a2abc8372c61c43190206ff9b` |
| Browser | Chrome cloud browser; exact version not exposed |
| Observed viewport | 1363 × 936 |
| Test date | 11 October 2026 |
| Automated checks | Full CI #286 passed for the tested application revision |
| Mobile, zoom and clipboard | Pending; no 200% zoom or physical-device pass |
| Public application | Render maintenance page; no release performed |

Earlier October scenarios remain reusable test instructions, not evidence against the current paid gate. Historical Docker build and encrypted synthetic restore results are recorded in `PAID_WEB_RELEASE.md`.

## Secure-access restriction

Secure credential submission did not produce a verified signed-in app session. Automatic security review rejected manual browser handoff and explicitly prohibited workarounds, indirect execution, alternate browser surfaces and policy circumvention. Do not retry the blocked outcome through another interface. No new test account is required: the owner confirmed only the existing synthetic QA accounts.

Provider-decline browser entry has a separate exhausted-credit block; real browser account deletion has a separate security block. Preserve each restriction. Signed-in tests remain pending until an approved secure workflow is available. Do not count synthetic HTTP tests as successful browser authentication.

## Paid-access acceptance

Complete in the existing private environment after secure access is available. Reconfirm the tested revision and private port visibility first. Do not deploy or activate live payments.

| Scenario | Expected result | Status |
|---|---|---|
| Signed-out access | Account/purchase screen; no planning controls or guest payment button | Passed, bounded desktop observation |
| Signed-out /admin | Protected-access message; no metrics | Passed |
| Signed-in unpaid account | Planning unavailable; secure-payment action available | Pending |
| Signed-in sandbox purchase | Verified payment grants planning access to purchaser | Pending for current gate |
| Cancelled or unpaid checkout | No planning access or new ownership | Pending for current gate |
| Invalid return identifier | No access; retry visible; no replacement checkout | Passed with synthetic invalid identifier only |
| Successful return replay | Same ownership; no additional purchase | Pending real provider evidence |
| Reload and relogin | Purchaser ownership restored | Pending for current gate |
| Account switch | Other account has no purchaser records or ownership | Pending |
| Already-owned checkout attempt | No duplicate charge or new checkout | Pending browser evidence |
| Provider decline and refund | Correct reviewed entitlement behaviour | Pending; existing blocks apply |
| Normal user /admin | No metrics or administrative access | Pending |
| Allowlisted admin /admin | Authorised metrics only | Pending |
| API outage and recovery | Access fails closed; recovers without new payment | Pending; attempted interruption never executed |

## Public help and accessibility acceptance

Observed: app price-free working-page content, correct examples/support destinations and support email, Enter-operated app FAQ, declined optional analytics, website three examples, ArrowRight example selection, privacy and product-information opening, privacy Escape with trigger focus restored.

Still pending: complete Tab/Shift+Tab sequence, dialog focus containment, visible focus, measurable 200% zoom, phone-width layout, error announcements, clipboard/popup fallback and independent usability. No email delivery was attempted. Physical iPad Safari remains the final acceptance gate after other checks.

## Scenario A — core electricity renewal

Search for `Octopus electricity tariff renewal`, accept the energy-renewal suggestion and use:

| Field | Synthetic value |
|---|---|
| Provider or organisation | Octopus Energy |
| Account or customer reference | SYN-ELEC-2026-001 |
| Supply type | Electricity |
| Tariff or plan | Standard variable |
| Annual usage | 2,900 kWh electricity |
| Unit rate(s) | 24.5p/kWh electricity |
| Standing charge(s) | 52p/day electricity |
| Exit fee | £0 |
| Renewal date | 2026-11-30 |
| Current price | £112.50 |
| Current price frequency | Monthly |
| Renewal quote | £1,470 |
| Renewal quote frequency | Annual |
| What matters most? | Lowest total cost |
| Would you switch provider? | Yes, if the deal is better |

Pass only when all of the following are observed:

- Search preserves `Octopus Energy`, electricity and the renewal goal into the task form.
- The saved task still shows the synthetic provider/reference, usage, rates and date.
- Generate plan produces Next steps, Provider message, Things to check and Approval checklist without inventing missing figures.
- The provider message contains only supplied synthetic details, can be edited in the UI and the edit remains visible before copying or emailing.
- The generated plan appears under Saved results and reopening it restores the same four sections and retained context.
- Continue with AI opens an editable prompt. Gemini, Microsoft Copilot, ChatGPT, Claude and Perplexity remain manual links; no prompt or customer detail is transmitted automatically.
- With popup or clipboard access blocked, the prompt remains visible and selectable, with clear fallback guidance.

## Scenario B — unknown payment

Search for `unknown recurring card payment` and use:

| Field | Synthetic value |
|---|---|
| Statement description | SYNTHETIC MERCHANT 4812 |
| Amount | £12.99 |
| Payment date | 2026-10-02 |
| Payment method | Debit card |
| Payment status | Posted |
| Does it repeat? | Yes |

Pass only when the generated result is a bank-query workflow, does not fabricate a provider identity, and does not offer a normal provider email as if the merchant were known. Save and reopen the plan and confirm the synthetic statement wording remains intact.

## Scenario C — protected administration

Open `/admin` in a fresh signed-out session. Pass only when no dashboard data appears and the protected-access message is clear. Repeat with a normal non-admin synthetic account; it must remain denied. An allowed-admin pass remains pending until the owner securely configures an authorised test administrator—do not place an administrator identity in this file or the pull request.

## Defect record

For every failure, record:

| Field | Required evidence |
|---|---|
| Revision | Full commit SHA |
| Environment | Browser/version, viewport and preview URL |
| Scenario/step | Exact scenario and numbered action |
| Expected | One observable outcome |
| Actual | What appeared or failed |
| Evidence | Screenshot or concise browser log with no sensitive data |
| Severity | Release blocker, major, minor or observation |
| Reproduction | Consistent, intermittent or once |

Do not edit implementation code until the defect is reproduced. Keep privacy, payment or security fixes in an isolated batch and run the required CI workflow once after the complete fix batch.

## Still outside supported-browser evidence

- Physical iPad/touch behaviour and real clipboard/popup handling
- New Docker runtime evidence only if a material Docker change requires another run; earlier one-time verification passed
- Native iOS/Android packages, signing, billing and store review
- Live payments, hosting and publication
- Allowed-administrator production configuration and durable-storage recovery drill
