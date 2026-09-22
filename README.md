# LifeAdmin AI

LifeAdmin AI helps people sort household bills, renewals, subscriptions and recurring payments with clear next steps, provider-ready messages and review checklists.

The working application lives in [`lifeadmin_build/`](lifeadmin_build/).

## Quick start

Requirements: Node.js 20+ and Python 3.11+.

```bash
cd lifeadmin_build
npm install
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
npm install
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
- One-time Core and All Access pricing model
- Protected admin dashboard
- Opt-in analytics readiness
- Automated GitHub Actions validation for tests, type checks and production frontend build

See [FINAL_QA.md](lifeadmin_build/FINAL_QA.md) for the latest verification status and [DEPLOYMENT.md](lifeadmin_build/DEPLOYMENT.md) for production setup.

## Privacy model

LifeAdmin AI does not require bank access or mailbox access. It does not automatically contact providers or send data to another AI assistant. Users review actions before using them.

## Development approach

This repository is independent of Replit Agent. Standard npm, Vite and Python tooling is used so the app can run in GitHub Codespaces or another compatible host.
