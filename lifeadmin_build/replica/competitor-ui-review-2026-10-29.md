# HomeAdmin competitor review and incremental UI upgrade
Date: 2026-10-29
Baseline: PR #17 head a58aad07e7e4956a7c79d1f2bd71041a957865f5, draft, unmerged. Current update commit 6df6d82171e66d16a757098e64091c4720d34ef6.
Scope: public feature documentation, not hands-on competitor account testing.

| App | Publicly described strength | HomeAdmin response | Boundary |
| --- | --- | --- | --- |
| Bobby | Simple fixed-cost tracking and due notifications (https://bobbyapp.co/) | Surface recurring costs and direct saved-bills navigation | Do not copy visual assets or wording |
| Snoop | Bills, renewal alerts, spending insights and recommendations (https://www.snoop.app/how-it-works/) | Make dates/action prominent and retain guided AI assistance | No bank connection or automatically verified price comparisons |
| Rocket Money | Upcoming, All, Calendar bill views (https://help.rocketmoney.com/en/articles/3117398-where-can-i-view-my-subscriptions-and-bills) | Provide direct routes to dates and the full bill list from Home | No auto detection or cancellation claims |

## Priorities
P1 Done in this change: accessible, compact quick actions for saved bills, upcoming dates and resumable drafts in existing overview. Existing sections, bill data, saving and AI flow unchanged.
P1 Next: prototype distinct adaptive Home / Bills / Plans / Diary / Settings views in a separate PR, only after current PR #17 checks pass and its existing work is protected.
P1 Next: beginner testing and installed-device acceptance, plus synthetic and real-provider AI quality assessment.
P2 Later: calendar views and recurring cost category breakdowns, after local data and accessibility checks.
Defer: bank integration, automatic cancellation, unverified savings estimates, auto-sending provider emails.

## Validation
Code update has been committed to PR #17 branch. New CI run 40887476684 was pending at first inspection. Do not treat this document as test evidence. No merge or deployment performed.

## Preservation
Keep HomeAdmin / TenaciousPL branding, local-only bill storage, backup compatibility, saved plans/messages, Copilot/default chosen AI, optional Gemini with consent, separate currencies, Water/Energy distinction, and existing native QA steps. No competitor assets or proprietary code reproduced.
