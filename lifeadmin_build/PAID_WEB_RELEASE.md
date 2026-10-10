# Paid web release preparation

Status: prepared for review, not submitted or published. Native app-store work is deferred.

Supported browser QA completed on 7 October 2026 against application revision `00762a39046031ef46f944a059492301601cab37`; CI #124 passed for that exact application revision and CI #125 passed for documentation head `868dea9359980b83dcccfe1810c55ba90f43498c`. The completed browser evidence does not cover physical iPad behaviour, protected-admin browser behaviour or payments. The separate one-time Docker build/start/restart/persistence/backup check passed on owner-provided Codespaces evidence on 8 October 2026.

## Existing Render service (verified 9 October 2026)

The earlier statement that no hosting service existed is superseded. Read-only Render service inspection confirms an existing `LifeAdmin-AI` web service (`srv-db4c8u49v7es73a601jg`) connected to `Tenaciousp/LifeAdmin-AI`, branch `dev/energy-renewal-plan`, with Docker runtime, one instance, a 1 GB persistent disk mounted at `/app/artifacts/api-server/data`, Frankfurt region and **automatic deployment disabled**. Render reports service URL `https://lifeadmin-ai-an0o.onrender.com`. This inspection does **not** establish that the latest application revision is deployed, secure, ready for customers or approved for publication. Do not trigger a deployment or change access settings based on this documentation update.

`deploy/render.draft.yaml` remains a draft configuration and is not proof of the running service's complete settings. Before any further deployment or spending, confirm the current billing owner, exact total price including disk/tax, service health, public accessibility, production secrets and storage recovery. Keep GitHub as source of truth and retain an independent export. No new service or subscription is authorised by this note.

Use a single application instance with SQLite. The disk preserves the entire API data directory, including guest JSON files. Review write concurrency and database migration before scaling. Set APP_BASE_URL to the exact HTTPS origin, ADMIN_EMAILS to the owner's authorised account, and keep the generated SESSION_SECRET private and stable. No Stripe or AI keys are included in the draft. DEMO_PAYMENTS remains false.

## Payment setup, still without live sales

LifeAdmin AI Complete is £1.99 UK / $1.99 US once, with all current planning features included. Existing purchasers retain full access. Verify actual checkout currency and amount for each market before enabling payments; the selector changes display only. Review processor fees against these low prices.

In an authorised private preview, use Stripe sandbox credentials and a complete-product sandbox Price ID only. Follow MONETISATION.md for supported environment variables and checkout configuration. Test purchase, cancellation, failed payment, return verification, duplicate confirmation and account entitlement persistence. Never accept a browser return alone as proof of payment. Verify entitlement enforcement against the final paid feature boundaries. Preview safeguards passed automated tests; no real Stripe transaction was tested in this workspace.

Prepare privacy, terms, refund policy, support contact and accurate product descriptions for owner review. Confirm deletion, billing-record retention and analytics consent wording. Do not enable live credentials, publish, merge the draft PR or submit this configuration during preparation.

## Backup and restore

The runtime image includes `scripts/backup_data.py`. With writes stopped, run:

```sh
python scripts/backup_data.py /app/artifacts/api-server/data /tmp/lifeadmin-backup-YYYYMMDD
```

Use a new destination outside the live data directory. The script uses SQLite's backup API, checks database integrity, validates present guest JSON files, produces SHA-256 hashes and private permissions, and refuses to overwrite an existing backup. Writes must be quiesced for consistency across the database and JSON files.

A /tmp backup is temporary, not disaster recovery. Before launch, establish a secure independent backup destination, retention schedule and responsible owner. Transfer real customer data only through an authorised secure route. Test restoration in an isolated environment with matching app revision, then check account and guest plans. Do not overwrite production during a restore test. The helper expects the default lifeadmin.sqlite3 filename; adapt deliberately if storage configuration changes.

## One-time Docker verification

The current automation environment has no Docker, Podman, Buildah or nerdctl engine, so it cannot provide runtime image evidence. Do not add an always-on Docker CI job solely to close this one-time gate. In the existing private Codespace, or another authorised Docker host, run from `lifeadmin_build`:

```sh
bash scripts/verify_docker_release.sh
```

The bounded script builds the repository Dockerfile, binds the container only to loopback on a random host port, runs the web/API smoke path, confirms preview-only payments, creates a synthetic energy task, exercises the packaged backup helper, restarts with the same mounted data and verifies provider/reference persistence. It uses synthetic values, does not deploy, does not publish ports publicly, and needs no owner or Stripe credentials. It cleans up its container and successful image after completion.

Record the exact application commit, Docker version and final pass line. If it fails, retain the non-sensitive failure output and container log; do not repeatedly retry an unchanged failure. The one-time Docker release gate **passed** on owner-provided Codespaces terminal evidence on 8 October 2026 (exact runtime commit was not captured). Do not repeat unchanged Docker verification; retain the original evidence and capture the commit if a material Docker change requires another run.

## Restricted Google Drive synthetic rehearsal (verified 9 October 2026)

The owner completed the private `lifeadmin-drive:` rclone OAuth flow in Codespaces. A non-sensitive token-presence check returned true, and `rclone lsd lifeadmin-drive:` completed without errors. The test-only rehearsal `python3 scripts/rehearse_drive_backup.py lifeadmin-drive:LifeAdmin-AI-Automated-Backups` reported **encrypted upload verified, no files deleted, and synthetic encrypted upload and offline restore verified**. The disposable encryption key was discarded, leaving an unrestorable encrypted synthetic object in the remote folder. This is **not** a production backup policy or recovery setup. No customer data was transferred and no automated schedule was enabled. Production still requires independently managed recoverable keys, consistency controls, restore ownership, retention/alerting and durable OAuth authorisation; OAuth Testing refresh tokens can expire.

## Minimum owner decisions and actions

1. One-time Docker verification and test-only encrypted Drive upload/offline restore have passed. Preserve this evidence and do not rerun unchanged checks.
2. Test the current revision on a physical iPad **as the final acceptance gate**, after the independent admin, recovery, security and sandbox-payment checks. Include touch, keyboard, clipboard fallback, account screens and payment-return layout. Browser emulation is not physical-device evidence.
3. Provide one authorised non-admin account and one allowlisted admin account through secure configuration, then verify both protected-admin browser outcomes without sharing credentials.
4. Choose the paid-web host, domain/public URL, billing owner, data region and acceptable total recurring cost after reviewing the provider's current checkout quote. Do not purchase until approved.
5. Supply publisher/legal identity, support contact, privacy/terms/refund content, analytics-consent wording, and account/billing data-retention rules.
6. Approve the production administrator allowlist, stable secret handling, persistent SQLite or PostgreSQL storage, off-host encrypted backup destination, retention schedule, restore rehearsal and responsible recovery owner.
7. After the above decisions, supply Stripe sandbox credentials and sandbox Price IDs through the host's private secret store for test-mode purchase, cancellation, failure, return, webhook and entitlement checks. Live credentials and activation require separate explicit approval.

Until these actions are complete, keep the preview private and the release unpublished.

## Remaining release gates

- Supported HTTPS preview and `BROWSER_QA_RUNBOOK.md` completed using synthetic data against application revision `00762a39046031ef46f944a059492301601cab37`.
- Actual iPad Safari checks, including keyboard, clipboard, account screens and checkout returns.
- One-time Docker build/start/restart and mounted-persistence check completed on 8 October; production configuration and operational recovery still require owner approval.
- Sandbox payment lifecycle and final paid-access enforcement verified.
- Test-only off-host encrypted backup and isolated restore rehearsal completed on 9 October; production backup key custody, recovery/retention and support/legal review remain pending.
- Owner approval of recurring cost, final domain, production settings and publication.

This document update made no new subscription, purchase, deployment or live-payment change. The existing Render service is separately verified above.
