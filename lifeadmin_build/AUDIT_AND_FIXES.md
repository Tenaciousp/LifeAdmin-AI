# LifeAdmin AI project audit and fixes

Date: 22 September 2026

## Executive summary

The exported project contained a solid web/API foundation but several gaps between the approved LifeAdmin AI product specification and the implementation. The most important issues were inconsistent client/server contracts, incomplete dynamic routing fields, unsafe payment-readiness assumptions, weak portable database setup, misleading analytics events, and customer-flow friction.

The local completion pass preserved the existing product architecture while moving product rules to the server-owned domain model, strengthening payment/privacy checks, improving the customer experience and landing page, and expanding automated regression coverage.

## Important issues, root causes and fixes

### 1. Popular bill choices did not render reliably

**Root cause:** the API returned `popular_choices` while the web client read `popular`.

**Fix:** the canonical API now exposes `popular_choices` and a compatibility alias; the client prefers `popular_choices`.

### 2. TV, broadband and mobile did not receive its intended specialist fields

**Root cause:** specialist fields were stored under a legacy `communications` key instead of the canonical category ID.

**Fix:** the domain model now uses `tv_broadband_mobile` and combines category fields with goal-specific fields using deduplication.

### 3. Dynamic forms were only partly dynamic

**Root cause:** goals had no field definitions and the client therefore could not ask renewal-, cancellation-, dispute- or negotiation-specific questions.

**Fix:** all seven goals now carry relevant optional/recommended fields and the client renders the merged category/goal form.

### 4. Missing-detail checks disagreed between browser and server

**Root cause:** the client treated many fields as missing while the API checked only `required` fields, and almost all fields were optional.

**Fix:** both flows now use required/recommended semantics. Duplicate missing-detail labels are removed and generation remains non-blocking.

### 5. Smart routing could misclassify ordinary words

**Root cause:** synonyms used raw substring matching. A short provider name such as `EE` matched the letters inside `fees`, routing `nursery fees` to telecoms.

**Fix:** routing now uses word/phrase boundaries. Telecom price language also routes to price reduction rather than generic bill checking when appropriate.

### 6. Manual category selection defaulted to the wrong goal

**Root cause:** the UI selected `identify_payment` as the first/default goal regardless of category.

**Fix:** manual selection now requires an explicit goal unless the user chose a preset quick action. Suggested routes preselect a goal only when confidence rules return one.

### 7. Unknown-payment fallback used a non-canonical category

**Root cause:** task creation still contained a legacy `other_payment` fallback.

**Fix:** task normalisation now guarantees `other_regular_payment` and validates both category and goal IDs.

### 8. New guest sessions could inherit demo-style content

**Root cause:** default tasks were seeded for anonymous workspaces.

**Fix:** new guest workspaces start empty. Guest data remains isolated by a server-issued signed cookie.

### 9. Provider email gating was fragile

**Root cause:** older logic inferred message sections from text and could mistake checklist/search content for a provider message.

**Fix:** results use server-owned structured fields. Email actions depend only on a genuine structured provider message. Unknown payments instead receive a clearly identified bank-query draft.

### 10. Clipboard actions reported success even when copying failed

**Root cause:** clipboard promises were not awaited.

**Fix:** copy actions are awaited and now provide a usable manual-copy error message on failure.

### 11. Stripe availability could be shown before checkout was actually usable

**Root cause:** readiness checked only for a Stripe secret, not the product price ID.

**Fix:** every product has explicit `checkout_ready` state. The UI remains in preview mode until both products are configured. Internal environment variable names are no longer exposed in the customer API.

### 12. Entitlements could be granted too early

**Root cause:** checkout completion was previously treated as sufficient without confirming paid status.

**Fix:** status checks and webhook processing grant entitlements only after Stripe reports payment as paid (or the asynchronous payment success event arrives).

### 13. Demo purchases were risky in a production environment

**Root cause:** demo-payment behaviour depended only on a feature flag.

**Fix:** production mode rejects demo purchases even if a demo flag is accidentally present.

### 14. OpenAI response extraction could duplicate text

**Root cause:** text parts were appended through overlapping parsing paths.

**Fix:** response extraction now uses one consistent path.

### 15. Admin overview fallback could repeat a failed database call

**Root cause:** the exception path retried storage aggregation when `DATABASE_URL` existed even though that storage operation had just failed.

**Fix:** fallback aggregation uses isolated local guest data instead of repeating the failing database call.

### 16. A fresh PostgreSQL database had no schema bootstrap

**Root cause:** the export relied on database tables already existing in the hosting environment.

**Fix:** `storage.ensure_schema()` creates the required users, sessions, tasks, notes and purchases tables/indexes when database storage is available.

### 17. Landing-page conversion path was too generic

**Root cause:** the old positioning mixed broad admin jobs with the household-bill product and did not surface the approved examples/trust model quickly enough.

**Fix:** the landing page now leads with the household-bill promise, examples, how-it-works, guided product, trust section, account choice, one-time pricing and FAQ, with prominent “Start with a bill” calls to action.

### 18. Account creation appeared too central to first use

**Root cause:** account functionality competed with the task flow.

**Fix:** the customer can try the planning flow first. The account section clearly positions sign-up as the way to save/return later. Deletion requires password plus typing `DELETE`.

### 19. Admin dashboard lacked useful operational structure

**Root cause:** it had only three summary cards and raw category/goal IDs.

**Fix:** it now includes account/task/plan/purchase cards, readable category/goal charts, status/entitlement breakdowns, privacy-light recent activity, filters and responsive navigation. Backend access remains administrator-only.

### 20. Analytics was not ready for later Google Ads measurement

**Root cause:** events were tied only to one analytics provider and one hero click was incorrectly labelled as checkout.

**Fix:** the hero uses `start_flow`; the analytics bridge supports Umami, optional `gtag` and optional `dataLayer`, while filtering sensitive/free-text property keys.

### 21. Exported TypeScript config referenced a missing local package

**Root cause:** the Replit workspace export retained a reference and dependency on `lib/api-client-react`, but that library was not included and the app did not import it.

**Fix:** the unused dependency/reference was removed and the root TypeScript project no longer references missing library projects.

## UI and accessibility improvements

- Mobile-first calls to action and task flow
- Responsive landing page and admin dashboard
- Six-step customer journey language
- Minimum practical touch targets on important actions
- Visible keyboard focus states
- ARIA tab semantics and keyboard arrow navigation for result tabs
- Clear loading, empty and error states
- Provider-message empty state instead of fabricated copy
- Privacy reminders before AI handoff and data entry
- Removed viewport zoom blocking so users can scale text/content
- No bank connection, mailbox access or automatic AI sharing claims

## Automated validation

The exported repository originally contained 15 discoverable Python/static contract tests. After this pass the suite contains 27 tests, including the approved nine household scenarios plus additional dynamic-form, routing, payment-safety, landing-page, analytics and account-deletion contracts.

Latest local result: **27 passed, 0 failed**.

Python modules also pass `py_compile`. TypeScript/TSX source files pass a syntax parse using the TypeScript compiler. A full dependency-resolved Vite build was not run in this offline container because the JavaScript dependencies are not installed in the export environment.

## Remaining external launch blockers

These are not source-code placeholders and require owner/platform credentials or external accounts:

1. Live Stripe secret, webhook secret and final Core/All Access Stripe price IDs.
2. Production AI provider credential/configuration if live-model output is desired. The deterministic guided fallback remains usable without it.
3. Production PostgreSQL connection string for persistent registered accounts.
4. Final business/legal identity, privacy contact, support URL, hosted privacy policy, terms and retention disclosures.
5. Administrator allowlist email(s).
6. Apple Developer and Google Play Console setup, native packages, in-app purchases, signing, device QA and store assets for native release.
7. GA4/Google Ads/Firebase identifiers only when measurement is ready to be activated. Do not launch paid advertising before conversion and privacy QA.

## Recommended release order

1. Import this cleaned project and run the web/API build in the hosting environment.
2. Perform browser and mobile-device QA on the nine benchmark scenarios.
3. Configure production database and AI service.
4. Configure Stripe in test mode and verify webhook/checkout ownership and entitlements.
5. Add final policies/business contact details.
6. Run a limited public web demo.
7. Switch Stripe to live after payment QA.
8. Add production analytics tags, verify privacy-safe events, then start a small paid-acquisition test.
9. Build native iOS/Android versions only after the web product is stable.

## Portable completion pass

The project was subsequently completed as a Replit-independent web codebase.

### Additional issues found and fixed

22. **Replit-specific build dependency**
    - Root cause: the frontend toolchain relied on Replit-specific Vite plugins and workspace conventions.
    - Fix: converted the repository to normal npm workspaces, removed Replit runtime plugins and added a standard Vite configuration.

23. **Database required external PostgreSQL even for development**
    - Root cause: account persistence was coupled to PostgreSQL.
    - Fix: introduced a zero-configuration SQLite backend with the same account, task, note, purchase and admin operations. PostgreSQL remains optional for production scaling.

24. **SPA was not self-hostable from the API process**
    - Root cause: frontend and API assumed separate managed workflows.
    - Fix: the Python server now serves the production SPA build and keeps unknown `/api` routes as JSON 404s.

25. **Guest session signing key changed between restarts**
    - Root cause: a development secret could be generated only in memory.
    - Fix: development uses a persistent local signing secret. Production fails fast unless an explicit secret is configured.

26. **Guest purchases were not migrated with a new account**
    - Root cause: workspace migration only moved tasks and notes.
    - Fix: eligible guest purchase entitlements migrate to the new account along with the guest workspace.

27. **Stripe return did not verify entitlement immediately**
    - Root cause: the browser returned from checkout without calling the server-side checkout status endpoint.
    - Fix: a checkout-return handler verifies payment state, refreshes entitlements and reports cancelled or processing checkout safely.

28. **Analytics could emit before user consent**
    - Root cause: the event bridge sanitised data but did not require an explicit analytics preference.
    - Fix: analytics now requires opt-in consent. A customer-facing consent control and analytics-choice reset were added.

29. **External font request added avoidable tracking/performance overhead**
    - Root cause: the UI imported a remote font stylesheet.
    - Fix: replaced it with a modern system font stack.

30. **Generated saved plans had no practical reopen workflow**
    - Root cause: plans were stored but the customer flow did not surface them usefully.
    - Fix: signed-in and guest users can reopen recent plans and restore the structured result view.

31. **Named subscription playbook ignored canonical task details**
    - Root cause: provider recognition read legacy note text instead of the structured `details.provider` field used by the current UI.
    - Fix: named subscription handling now uses canonical task data first, producing provider-first Netflix and other subscription guidance.

32. **Challenge-charge outputs were too generic**
    - Root cause: category playbooks were not sufficiently goal-aware.
    - Fix: added goal-aware card dispute, mobile-bill challenge and council-tax query flows with appropriate checks and provider drafts.

33. **Provider email subjects were generic task titles**
    - Root cause: email construction did not use the customer goal.
    - Fix: subjects now reflect renewal, reduction, cancellation, dispute, contact or bill-query intent.

34. **Higher-risk scenarios lacked an explicit escalation layer**
    - Root cause: standard bill workflows did not distinguish fraud, threatened disconnection, eviction/repossession or urgent insurance incidents.
    - Fix: a safety overlay now points customers to official provider channels and qualified support without presenting the app as legal or regulated advice.

35. **Authentication endpoints lacked a simple abuse guard**
    - Root cause: only plan generation was rate-limited.
    - Fix: registration and sign-in now use a per-IP short-window rate limit in addition to secure password hashing.

36. **Admin recent-activity contract differed by database backend**
    - Root cause: PostgreSQL returned a `details` key while SQLite and the UI used `category`.
    - Fix: both storage backends now return the same admin activity shape.

### Validation after portable completion

- 37 automated Python/domain/frontend-contract tests pass, 0 fail.
- 72 TypeScript/TSX source files pass syntax transpilation and the frontend dependency-import audit passes.
- Zero-configuration SQLite lifecycle tests pass, including account deletion and purchase persistence.
- Python modules compile successfully.
- The current source no longer requires a Replit runtime or Agent to build or run.

### External launch work, not code defects

Live public launch still requires the product owner's hosting/domain choice, production secrets, Stripe products/webhook if payments are enabled, final business/legal details, and any chosen production AI credentials. Native Apple and Google store release remains a separate phase.
