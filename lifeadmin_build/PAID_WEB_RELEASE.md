# Paid web release preparation

Status: prepared for review, not submitted or published. Native app-store work is deferred.

Supported browser QA completed on 7 October 2026 against application revision `00762a39046031ef46f944a059492301601cab37`; CI #124 passed for that exact application revision and CI #125 passed for documentation head `868dea9359980b83dcccfe1810c55ba90f43498c`. The completed evidence does not cover physical iPad behaviour, protected-admin browser behaviour, a Docker image run or payments.

## Draft hosting

`deploy/render.draft.yaml` describes one Docker web service with a 1 GB persistent disk. No service has been created. The draft is deliberately outside the root Blueprint path. Automatic deployment is disabled; submitting the draft would still create an initial deployment and incur hosting charges.

Before any submission, confirm the host, current total price including disk/tax, billing owner, Frankfurt data region, domain and public URL. Review the £10–15/month planning allowance against the actual checkout quote; this is not a price guarantee. Keep GitHub as the source of truth and retain an independent export.

Use a single application instance with SQLite. The disk preserves the entire API data directory, including guest JSON files. Review write concurrency and database migration before scaling. Set APP_BASE_URL to the exact HTTPS origin, ADMIN_EMAILS to the owner's authorised account, and keep the generated SESSION_SECRET private and stable. No Stripe or AI keys are included in the draft. DEMO_PAYMENTS remains false.

## Payment setup, still without live sales

Core access is £0.99/$0.99 once; All Access is an additional £1.99/$1.99 once. Confirm launch currency and final entitlement wording before creating payment products. Review processor fees against these low prices.

In an authorised private preview, use Stripe sandbox credentials and sandbox price IDs only. Follow MONETISATION.md for supported environment variables and checkout configuration. Test purchase, cancellation, failed payment, return verification, duplicate confirmation and account entitlement persistence. Never accept a browser return alone as proof of payment. Verify entitlement enforcement against the final paid feature boundaries. Preview safeguards passed automated tests; no real Stripe transaction was tested in this workspace.

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

Record the exact application commit, Docker version and final pass line. If it fails, retain the non-sensitive failure output and container log; do not repeatedly retry an unchanged failure. The Docker release gate remains pending until this command passes on a Docker-capable host.

## Minimum owner decisions and actions

1. Run the one-time Docker verification above in the existing private Codespace or another authorised Docker host and return the pass line or non-sensitive failure output.
2. Test the current revision on a physical iPad, including touch, keyboard, clipboard fallback, account screens and payment return layout. Browser emulation is not physical-device evidence.
3. Provide one authorised non-admin account and one allowlisted admin account through secure configuration, then verify both protected-admin browser outcomes without sharing credentials.
4. Choose the paid-web host, domain/public URL, billing owner, data region and acceptable total recurring cost after reviewing the provider's current checkout quote. Do not purchase until approved.
5. Supply publisher/legal identity, support contact, privacy/terms/refund content, analytics-consent wording, and account/billing data-retention rules.
6. Approve the production administrator allowlist, stable secret handling, persistent SQLite or PostgreSQL storage, off-host encrypted backup destination, retention schedule, restore rehearsal and responsible recovery owner.
7. After the above decisions, supply Stripe sandbox credentials and sandbox Price IDs through the host's private secret store for test-mode purchase, cancellation, failure, return, webhook and entitlement checks. Live credentials and activation require separate explicit approval.

Until these actions are complete, keep the preview private and the release unpublished.

## Remaining release gates

- Supported HTTPS preview and `BROWSER_QA_RUNBOOK.md` completed using synthetic data against application revision `00762a39046031ef46f944a059492301601cab37`.
- Actual iPad Safari checks, including keyboard, clipboard, account screens and checkout returns.
- Docker image build and startup with production settings and mounted storage.
- Sandbox payment lifecycle and final paid-access enforcement verified.
- Off-host backup and isolated restore rehearsal; support and legal content reviewed.
- Owner approval of recurring cost, final domain, production settings and publication.

No new subscription, purchase, public deployment or live payment was made by this preparation.
