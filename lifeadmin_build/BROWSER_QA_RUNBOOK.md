# LifeAdmin supported-browser QA runbook

Prepared: 5 October 2026  
Target branch: `dev/energy-renewal-plan`  
Target revision: `2ca754171207fb01cbf117df1ed87cdd6445a60b`  
Application revision: `f9aa6fb191845b541648c454636c1128ba74c9c7`

Use only synthetic data. Do not enter real customer details, passwords, payment-card data or production secrets. Record the browser, version, viewport, preview URL, tested commit and result before marking an item passed. Browser emulation is not physical-device evidence.

## Environment record

| Evidence | Value |
|---|---|
| Preview URL | Pending authorised HTTPS preview |
| Tested commit | `2ca754171207fb01cbf117df1ed87cdd6445a60b` |
| Browser and version | Pending |
| Viewport | Pending; start at 390 × 844, then 1024 × 1366 |
| Tester/date | Pending |
| Popup policy | Pending |
| Clipboard permission | Pending |

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
- Full Docker-image build
- Native iOS/Android packages, signing, billing and store review
- Live payments, hosting and publication
- Allowed-administrator production configuration and durable-storage recovery drill
