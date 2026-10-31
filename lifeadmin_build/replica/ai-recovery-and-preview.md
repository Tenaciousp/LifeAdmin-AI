# AI recovery and store-preview follow-up

Date: 2026-10-29. Baseline: PR #17 head 5d01f939ac02e0832dfb6d05e81a282b21b5fef9. Preserve all earlier overview, entry, result and accessibility changes.

## Confirmed automation failure

CI run 40870496282, iPhone store-preview job 123435991511, failed before entering the first synthetic bill. The full store-screenshots.log reports Search as unreachable at the addSubscription helper. The failure screenshot shows the overview still at the top with Dates selected and Apple's Copy/Look Up/Translate menu open. This is evidence of a synthetic drag selecting text instead of scrolling, not evidence that a customer record failed to save.

Change: both directions of the bounded reveal helper start their native drag in the page gutter, eight points inside the WebView's left edge, rather than on centred text/cards. Keep the existing gesture durations, distance limits, 14-attempt bound, target visibility/hit checks, screenshot framing and dimension checks. Do not disable customer text selection or ignore a failing screenshot. Native validation requires a fresh Apple run; Linux cannot execute XCTest.

## AI workflow improvement

The in-app generation screen previously advised using a chosen AI or an offline draft after an availability or rate-limit error, but offered no direct path to either option. Two buttons now reach those existing flows. Chosen AI keeps the same reviewed prompt, brief, incoming message, selected fields and service preference. Offline preparation returns to the details step and requires an explicit Prepare action. Switching methods resets generation consent and review state through the existing change handler. No automatic retry, provider contact or result save is added.

The synthetic browser journey mocks readiness and a single HTTP 429 response. It checks consent before generation, one approved request only, the visible usage-limit error, an unchanged prompt after switching to Copilot, retained brief/incoming message, fresh consent on returning to Gemini, and an offline reply with the requested outcome and mandatory review. Accessibility checks cover the recovery screen at 100%/200% root text. These checks do not measure live Gemini answer quality.

## Hosted readiness

The earlier approved Render deployment dep-dbh4tuo473hc73893nc0 is live at d50810a909f14f69d4c110a0ee5a71b5e3269d82. The confirmed My Workspace service remains on main with auto-deploy off and maintenance enabled. Current key validity, model availability, native API-origin configuration and live generation are unverified. No secret value was read or changed, no new deployment was triggered, and maintenance mode was not changed during this iteration.

## Validation checkpoint

80 offline tests and frontend/API type checks pass. Production local build and bundle checks pass. The complete browser journey passes, including a synthetic rate-limit response, exactly one consented generation request, an unchanged prompt in the Copilot fallback, retained request context, fresh consent on returning to in-app generation, and offline reply preparation with mandatory review. Recovery-screen WCAG scans at 100%/200% text pass. The gesture correction and combined candidate require fresh Apple CI. No merge or deployment is included. Overall 9/10 acceptance remains open pending live AI, beginner usability and installed-device evidence.


## Release instruction and privacy review

The user explicitly authorised deployment and live AI integration on 2026-10-29. Before enabling generation, the published app privacy notice must describe the optional HomeAdmin-to-Google request path, service processing and retention limits, consent, usage limits and Google free-tier terms. The retrieved notice dated 19 October describes external copy/paste only. Google's current model deprecation reference lists no announced shutdown for the configured stable gemini-2.5-flash-lite model; do not change models based on speculation. Render documentation confirms environment updates need an applicable deploy to become active. Dashboard maintenance controls require separate sign-in; the connector does not expose that setting. No live-AI success is claimed at this checkpoint.


Google's retrieved Gemini API Additional Terms (effective 23 March 2026) require Paid Services for API clients offered to UK/EEA/Swiss users. A billing-enabled Cloud project is therefore a release prerequisite for this UK app, separate from free consumer chat accounts. The owner's earlier preference to avoid API billing means a billable route must not be enabled without confirming project billing and an operating limit. Consent copy now refers to the privacy notice/API terms rather than implying that a free-tier API is the planned UK route. External Copilot/Gemini handoff remains available. Sources reviewed: https://ai.google.dev/gemini-api/terms and https://ai.google.dev/gemini-api/docs/deprecations.


The updated public privacy notice and AI FAQ were published through the existing HomeAdmin/TenaciousPL Site, version 16, source a358af7e9838695fdee9cae669ca675a1beff213. A fresh public fetch of https://tenaciouspl.co.uk/app-privacy confirmed the 29 October date and in-app Gemini section. PR #16 was merged as 9a2ea1a75115159a270926fe5e157ff0ba7eec8d after all eight checks passed. Its Render rollout dep-dbhk1b0u01pc73bhcp00 was started with maintenance preserved and AI configuration unchanged; terminal status must be verified separately. The new recovery/copy changes passed the rebuilt synthetic browser journey. Live acceptance cases and billing/budget prerequisites are recorded in live-ai-acceptance.md.
