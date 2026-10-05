# Paid web release preparation

Status: prepared for review, not submitted or published. Native app-store work is deferred.

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

## Remaining release gates

- Supported HTTPS preview and BROWSER_QA_RUNBOOK.md completed using synthetic data.
- Actual iPad Safari checks, including keyboard, clipboard, account screens and checkout returns.
- Docker image build and startup with production settings and mounted storage.
- Sandbox payment lifecycle and final paid-access enforcement verified.
- Off-host backup and isolated restore rehearsal; support and legal content reviewed.
- Owner approval of recurring cost, final domain, production settings and publication.

No new subscription, purchase, public deployment or live payment was made by this preparation.
