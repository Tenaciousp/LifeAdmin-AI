# LifeAdmin AI owner-review QA

Updated: 8 October 2026

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
- One complete purchase at £1.99 UK / $1.99 US, all planning modes included
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

CI #124 passed against the exact browser-tested application revision `00762a39046031ef46f944a059492301601cab37`. CI #125 then passed against documentation-only head `868dea9359980b83dcccfe1810c55ba90f43498c`:

- 162 automated API, domain, storage, privacy, payment-safety, backup and frontend-contract tests
- TypeScript type checking and Python compile validation
- A live API smoke journey covering health, catalog, preview-only pricing, guest energy-task creation, provider/reference preservation, structured plan generation, cross-guest isolation, guest-to-account migration, sign-out/sign-in isolation, saved-plan/task deletion and permanent account deletion
- A production Vite frontend build

Use the pull request's latest workflow result as the source of truth for the current head commit. A green workflow does not prove browser, clipboard, popup, responsive-layout or physical-device behaviour.

## Supported-browser QA — completed 7 October 2026

- A temporary GitHub Codespaces HTTPS preview exposed frontend port 5173 only; API port 8000 remained private and the preview was returned to Private after testing.
- Synthetic browser QA passed the core energy-renewal journey, provider/reference preservation, structured result tabs, editable provider message, saved-plan save/reopen/delete, unknown-payment Bank query, clipboard feedback and the editable manual handoff to all five supported assistants.
- Application revision exercised: `00762a39046031ef46f944a059492301601cab37`; CI #124 passed for that exact revision.
- Two initial findings were rejected after focused follow-up: the fish icon was the automation cursor, and missing-detail labels were present. Neither was recorded as an application defect.
- Protected-admin browser behaviour and physical iPad/touch/clipboard behaviour remain pending. Automated protection checks are not a substitute for the browser-admin pass.

## Portable-build checkpoint

- JavaScript dependencies are committed in `package-lock.json`; CI, container builds and the documented setup use `npm ci`.
- Docker build inputs now reference the existing `tsconfig.base.json` only. The previous `COPY` referenced a missing root `tsconfig.json`.
- Docker context exclusions also cover generated frontend output and environment-file variants.
- Local clean install, 162 tests, type checks and live API smoke passed before the browser evidence update. The production frontend build is validated by CI #124 and #125.
- Docker, Podman, Buildah and nerdctl are unavailable in the current automation environment. `scripts/verify_docker_release.sh` now provides one bounded build/start/restart/backup check for the existing Codespace or another authorised Docker host; it has passed shell syntax validation but has not yet been executed with Docker.

## Owner hands-on checklist

### Highest-priority customer path

- [x] On a phone-sized viewport, search for an electricity or gas renewal.
- [x] Confirm the suggested provider and renewal goal remain selected when the task is created.
- [x] Enter tariff, standing charge, unit rate, usage, renewal date and any customer reference.
- [x] Confirm the plan uses supplied values and identifies missing details rather than inventing figures.
- [x] Confirm the provider message is editable and includes the supplied synthetic provider/reference context.
- [x] Open the editable manual handoff and confirm Gemini, Microsoft Copilot, ChatGPT, Claude and Perplexity remain separate user-controlled actions.

### Alternative and recovery paths

- [x] Try an unknown card or bank payment and confirm the result is a bank-query workflow, not a provider email.
- [ ] Try cancellation, dispute, price-reduction and bill-checking goals in different categories; confirm alternatives match the selected goal.
- [ ] Force category, task, saved-plan and pricing requests to fail; confirm failures are not presented as empty data and retry controls work.
- [ ] While one plan is open, start a different task’s generation and cancel the missing-details review or force generation to fail; confirm the previous result still uses its original task context.
- [ ] Use keyboard-only navigation through search, missing-details review, result tabs, saved plans, account forms and pricing.
- [ ] At 200% zoom and on an iPad-sized viewport, confirm dialogs remain usable and important copy/actions are not clipped.

### Privacy and administration

- [ ] Create plans as two separate guests and confirm neither can view, change or delete the other's task or saved plan.
- [ ] Create an account, sign out and sign back in; confirm only that account's plans appear.
- [x] Delete a saved plan and confirm its private content disappears from the open result.
- [ ] Reopen a saved plan after its original task is unavailable and confirm “Continue with AI” opens an editable review prompt rather than doing nothing.
- [ ] Complete permanent account deletion and confirm the former credentials no longer work.
- [ ] Confirm a non-admin receives the protected-dashboard access message and an allowed admin can load, filter and retry dashboard data.

## Release guards

- Checkout must remain in preview until the owner separately approves live payments and configures the one-time complete product.
- The five external assistants are manual handoffs; the app must not send customer details automatically or incur paid AI usage.
- Do not publish, deploy, advertise or submit to app stores from this review branch.
- Do not place secrets, production customer data or private account details in test fixtures, issue comments or the pull request.
- Administrator access, production session secrets, persistence, legal wording, support details and any hosting choice require owner-supplied production decisions.

## Review record

Record the browser/device, viewport, scenario and exact failed step for every manual defect. Keep security, privacy and payment changes isolated from general usability fixes and validate them separately.
