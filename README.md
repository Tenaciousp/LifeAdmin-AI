# LifeAdmin

LifeAdmin helps people organise household bills, renewals, subscriptions and recurring payments into next steps, message drafts and review checklists.

## Current release

The agreed product is a **£1.99 upfront Apple/Google store download**, with local store equivalents. No LifeAdmin account, sign-in, trial, subscription or in-app checkout. Household bills and plans use device-local storage. The website provides examples, promotion and support.

Draft [PR #2](https://github.com/Tenaciousp/LifeAdmin-AI/pull/2) is unmerged. Development packages are not signed store releases. [Issue #3](https://github.com/Tenaciousp/LifeAdmin-AI/issues/3) is the current completion register. No release or live sales approval is recorded.

Implemented native functions include 12 bill/payment categories, seven goals, search suggestions, planning styles, saved bills/plans, deletion, native clipboard, and manual JSON backup export/restore. Native editable messages and manual AI handoff remain unfinished agreed requirements. Implementation does not establish device acceptance.

## Native development

Use Node 22 or later, plus the platform toolchain. From the repository root:

```bash
cd lifeadmin_build
npm ci
cd native
npm ci
npm run sync -- android
npm run android
```

For Apple, use a Mac with Xcode 26 or later and replace the last two commands with:

```bash
npm run sync -- ios
npm run ios
```

See [native setup](lifeadmin_build/native/README.md), [device acceptance](lifeadmin_build/native/DEVICE_TESTING.md), [release checkpoint](lifeadmin_build/DEVELOPMENT_CHECKPOINT.md), and [store preparation](lifeadmin_build/STORE_SUBMISSION.md).

## Privacy and recovery

No bank or mailbox connection is required. The app does not automatically contact providers or another AI assistant. Customers choose copying, external links and backup destinations.

Backup files contain readable personal information. Restore replaces existing bills and plans after confirmation and validation. Tenaciouspl holds no household-data recovery copy. OS cloud backup and device transfer depend on settings and observed platform support; purchase re-download alone does not restore household records.

## Historical web application

The repository retains the earlier Vite/Python account-based web application and its test evidence. Its accounts, hosted administration, Stripe and server-backup requirements do not govern the native release. Earlier web QA is not native acceptance evidence. Historical development commands and evidence remain in [lifeadmin_build](lifeadmin_build/README.md) and [FINAL_QA.md](lifeadmin_build/FINAL_QA.md).

Publisher: Paul Lonergan trading as Tenaciouspl. Support: tenaciouspl@icloud.com. Website: https://tenaciouspl.co.uk.
