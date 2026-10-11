# LifeAdmin AI

LifeAdmin AI helps people sort household bills, renewals, subscriptions and recurring payments with clear next steps, provider-ready messages and review checklists.

The working application lives in [`lifeadmin_build/`](lifeadmin_build/).

## Quick start

Requirements: Node.js 20+ and Python 3.11+.

```bash
cd lifeadmin_build
npm ci
npm run dev:api
```

In a second terminal:

```bash
cd lifeadmin_build
npm run dev:web
```

For a production build:

```bash
cd lifeadmin_build
npm ci
npm run build
npm start
```

## Current status

- 12 household bill/payment categories
- 7 action-based goals
- Search-first smart routing
- Dynamic detail forms
- Dedicated unknown-payment journey
- Structured Next steps, Provider message, Things to check and Approval checklist
- Account creation, saved plans and account deletion
- Privacy-safe manual AI handoff
- One LifeAdmin AI Complete package, with a proposed £1.99 UK one-time price and no subscription or separate upgrade
- Protected admin dashboard
- Opt-in analytics readiness
- Automated GitHub Actions validation for tests, type checks and production frontend build

The app is in final testing. Draft PR #2 remains unmerged, live sales are not approved, and the existing Render service retains maintenance mode with automatic deployment disabled. [Issue #3](https://github.com/Tenaciousp/LifeAdmin-AI/issues/3) is the current completion tracker; [FINAL_QA.md](lifeadmin_build/FINAL_QA.md) retains historical QA evidence and [DEPLOYMENT.md](lifeadmin_build/DEPLOYMENT.md) describes release preparation.

Publisher: Paul Lonergan trading as Tenaciouspl. Customer support: tenaciouspl@icloud.com. The promotional website and its purchased domain, tenaciouspl.co.uk, are separate from the app release. A published landing page does not establish app availability or payment readiness.

## Privacy model

LifeAdmin AI does not require bank access or mailbox access. It does not automatically contact providers or send data to another AI assistant. Users review actions before using them.

## Development approach

This repository is independent of Replit Agent. Standard npm, Vite and Python tooling is used so the app can run in GitHub Codespaces or another compatible host.
