# LifeAdmin AI owner-review QA

Updated: 5 October 2026

This branch is an owner-review candidate. Automated checks cover the application contracts and build, but they do not replace hands-on browser, iPad or phone testing.

## Scope ready for review

- Responsive household-bill assistant with 12 categories and seven goals
- Savings-first popular choices, smart search suggestions and goal dropdowns
- Category-specific plans with next steps, provider messages, things to check and approval checklists
- Energy-renewal comparison inputs for provider, tariff, rates, usage, renewal date and preferences
- Provider and customer details preserved from search through task creation and plan output
- Dedicated unknown-payment help with a bank-query draft
- Editable manual comparison handoff to Gemini, Microsoft Copilot, ChatGPT, Claude and Perplexity
- Guest and account data isolation, saved-plan reopening and owner-scoped deletion
- Protected administrator dashboard with explicit access and recovery states
- Core at £0.99 / $0.99 plus All Access at an additional £1.99 / $1.99
- Accessible loading, error, retry, dialog, status and keyboard interaction states

## Automated verification

The pull-request workflow installs dependencies in a clean environment and runs:

```text
npm ci
npm test
npm run typecheck
npm run dev:api
npm run build:web
```

The latest completed workflow at the time of this update passed:

- 159 automated API, domain, storage, privacy, payment-safety and frontend-contract tests
- TypeScript type checking and Python compile validation
- A live API smoke journey covering health, catalog, preview-only pricing, guest energy-task creation, provider/reference preservation, structured plan generation, cross-guest isolation, guest-to-account migration, sign-out/sign-in isolation, saved-plan/task deletion and permanent account deletion
- A production Vite frontend build

Use the pull request's latest workflow result as the source of truth for the current head commit. A green workflow does not prove browser, clipboard, popup, responsive-layout or physical-device behaviour.

## Supported-browser QA attempt — 5 October 2026

- Revision under review: `2ca754171207fb01cbf117df1ed87cdd6445a60b` (application code remains at `f9aa6fb191845b541648c454636c1128ba74c9c7`).
- The clean checkout's API started successfully at `http://127.0.0.1:8000` and Vite started successfully at `http://127.0.0.1:5173` without installing another builder or hosting service.
- The available supported Browser Use surface could not open the loopback preview and returned `net::ERR_BLOCKED_BY_CLIENT`.
- There is no authorised HTTPS preview URL recorded in the repository. No browser interaction was completed, so none of the hands-on checklist items below are marked passed.
- `BROWSER_QA_RUNBOOK.md` records the exact synthetic scenarios and evidence fields for the next authorised preview.

Owner action required to resume browser QA: provide an authorised HTTPS preview URL for this exact branch/revision, or approve a hosting choice and acceptable running cost. Do not include credentials or customer data. Physical iPad/touch/clipboard testing and a full Docker-image build remain separate outstanding checks.

## Portable-build checkpoint

- JavaScript dependencies are committed in `package-lock.json`; CI, container builds and the documented setup use `npm ci`.
- Docker build inputs now reference the existing `tsconfig.base.json` only. The previous `COPY` referenced a missing root `tsconfig.json`.
- Docker context exclusions also cover generated frontend output and environment-file variants.
- Local clean install, 159 tests, type checks and live API smoke passed on 4 October 2026. The production frontend build is validated by the latest pull-request workflow; the local transformation run did not complete promptly.
- A full Docker image build was not run in the local validation environment because Docker is unavailable. Browser/mobile QA is still outstanding.

## Owner hands-on checklist

### Highest-priority customer path

- [ ] On a phone-sized viewport, search for an electricity or gas renewal.
- [ ] Confirm the suggested provider and renewal goal remain selected when the task is created.
- [ ] Enter tariff, standing charge, unit rate, usage, renewal date and any customer reference.
- [ ] Confirm the plan uses the supplied values without inventing missing figures.
- [ ] Confirm the provider message is editable and includes only details the customer supplied.
- [ ] Open each of the five comparison assistants and verify the editable prompt remains available when popup or clipboard access is restricted.

### Alternative and recovery paths

- [ ] Try an unknown card or bank payment and confirm the result is a bank-query workflow, not a provider email.
- [ ] Try cancellation, dispute, price-reduction and bill-checking goals in different categories; confirm alternatives match the selected goal.
- [ ] Force category, task, saved-plan and pricing requests to fail; confirm failures are not presented as empty data and retry controls work.
- [ ] While one plan is open, start a different task’s generation and cancel the missing-details review or force generation to fail; confirm the previous result still uses its original task context.
- [ ] Use keyboard-only navigation through search, missing-details review, result tabs, saved plans, account forms and pricing.
- [ ] At 200% zoom and on an iPad-sized viewport, confirm dialogs remain usable and important copy/actions are not clipped.

### Privacy and administration

- [ ] Create plans as two separate guests and confirm neither can view, change or delete the other's task or saved plan.
- [ ] Create an account, sign out and sign back in; confirm only that account's plans appear.
- [ ] Delete a saved plan and confirm its private content disappears from the open result.
- [ ] Reopen a saved plan after its original task is unavailable and confirm “Continue with AI” opens an editable review prompt rather than doing nothing.
- [ ] Complete permanent account deletion and confirm the former credentials no longer work.
- [ ] Confirm a non-admin receives the protected-dashboard access message and an allowed admin can load, filter and retry dashboard data.

## Release guards

- Checkout must remain in preview until the owner separately approves live payments and configures both one-time products.
- The five external assistants are manual handoffs; the app must not send customer details automatically or incur paid AI usage.
- Do not publish, deploy, advertise or submit to app stores from this review branch.
- Do not place secrets, production customer data or private account details in test fixtures, issue comments or the pull request.
- Administrator access, production session secrets, persistence, legal wording, support details and any hosting choice require owner-supplied production decisions.

## Review record

Record the browser/device, viewport, scenario and exact failed step for every manual defect. Keep security, privacy and payment changes isolated from general usability fixes and validate them separately.
