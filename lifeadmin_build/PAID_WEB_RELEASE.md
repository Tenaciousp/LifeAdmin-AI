# Paid web release preparation

Status: prepared for review, not submitted or published. Native app-store work is deferred.

Supported browser QA completed on 7 October 2026 against application revision `00762a39046031ef46f944a059492301601cab37`; CI #124 passed for that exact application revision and CI #125 passed for documentation head `868dea9359980b83dcccfe1810c55ba90f43498c`. The completed browser evidence does not cover physical iPad behaviour, protected-admin browser behaviour or payments. The separate one-time Docker build/start/restart/persistence/backup check passed on owner-provided Codespaces evidence on 8 October 2026.

## Current release checkpoint, 11 October 2026 at 21:10 Europe/London

- **Automated build passed:** CI #284 completed successfully for application revision `1421cbd093ff216ff1367463a4129b8b13577f18`. Automated tests, backup locking/HTTP integration, encrypted synthetic backup/offline restore, type checks, API smoke and production frontend build passed.
- **Local paid-access coverage:** six paid-access HTTP checks and 39 existing payment/privacy/account/import tests passed. Synthetic coverage is separate from real Stripe provider and browser evidence.
- **Marketing website active:** https://tenaciouspl.co.uk has active HTTPS/SSL. The www hostname remains pending. Use the root address for examples and support. This is the marketing origin, not an approved payment-webhook or application origin.
- **Agreed offer:** one £1.99 GBP payment for all current planning functions. No subscription or separate upgrade. No pricing in app working screens; pricing appears on the website and secure checkout. Headline: “Your household bills. One place.” Supporting line: “List. Plan. Save.”
- **Paid public configuration:** `PAID_ACCESS_REQUIRED=true` is required before public paid access. The default false setting is reserved for authorised private QA. In paid mode, planning routes require verified ownership and new purchases require a signed-in account. Production startup rejects live Stripe keys without the paid-access flag. These safeguards are in the release candidate, not evidence of deployment.
- **Release state:** draft PR #2 is unmerged. Feature freeze continues. Maintenance mode stays enabled and automatic deployment stays disabled. No live payment activation, production backup scheduling or new spending was performed.

### Browser acceptance still required for the current paid-access revision

Record the exact private QA revision and use synthetic accounts and sandbox payments. Earlier browser success and guest cancellation predate the current account-before-payment gate.

1. Signed-out and signed-in unpaid users receive the access screen; direct planning requests stay blocked. Public website examples and support remain available.
2. A signed-in sandbox purchaser returns with verified access. An unpaid or cancelled return grants no access. Repeated checkout confirmation does not create another purchase.
3. Payment verification retry reuses the existing session. Reload and sign-out/sign-in restore ownership; another account receives no access to the purchaser's records.
4. Complete real provider decline, replay and refund checks with the reviewed entitlement policy. Local signed synthetic events do not establish provider lifecycle results.
5. Complete protected-admin, privacy, recovery and accessibility acceptance, including keyboard and 200% zoom, plus independent usability checks.
6. Perform physical iPad Safari testing last, after the other acceptance gates.

Automatic approval review blocked provider-decline browser entry because workspace credits were exhausted. A separate security-review block applies to real browser account deletion. Neither block is resolved by these automated results. Do not bypass either blocked action through another interface.

## Existing Render service (verified 9 October 2026)

The earlier statement that no hosting service existed is superseded. Read-only Render service inspection confirms an existing `LifeAdmin-AI` web service (`srv-db4c8u49v7es73a601jg`) connected to `Tenaciousp/LifeAdmin-AI`, branch `dev/energy-renewal-plan`, with Docker runtime, one instance, a 1 GB persistent disk mounted at `/app/artifacts/api-server/data`, Frankfurt region and **automatic deployment disabled**. Render reports service URL `https://lifeadmin-ai-an0o.onrender.com`. This inspection does **not** establish that the latest application revision is deployed, secure, ready for customers or approved for publication. Do not trigger a deployment or change access settings based on this documentation update.

`deploy/render.draft.yaml` remains a draft configuration and is not proof of the running service's complete settings. Before any further deployment or spending, confirm the current billing owner, exact total price including disk/tax, service health, public accessibility, production secrets and storage recovery. Keep GitHub as source of truth and retain an independent export. No new service or subscription is authorised by this note.

Use a single application instance with SQLite. The disk preserves the entire API data directory, including guest JSON files. Review write concurrency and database migration before scaling. Set APP_BASE_URL to the exact HTTPS origin, ADMIN_EMAILS to the owner's authorised account, and keep the generated SESSION_SECRET private and stable. No Stripe or AI keys are included in the draft. DEMO_PAYMENTS remains false.

## Payment setup, still without live sales

LifeAdmin AI Complete is one one-time purchase, with all current planning features included. The launch price is £1.99 GBP, paid once. Existing purchasers retain full access. Checkout uses one matching GBP Stripe Price; the server verifies its currency, active one-time status and exact amount of 199 pence before checkout. Complete payment, tax and sandbox checks before enabling live sales.

In an authorised private preview, use Stripe sandbox credentials and a complete-product sandbox Price ID only. Follow MONETISATION.md for supported environment variables and checkout configuration. Test purchase, cancellation, failed payment, return verification, duplicate confirmation and account entitlement persistence. Never accept a browser return alone as proof of payment. Verify entitlement enforcement against the final paid feature boundaries. Preview safeguards passed automated tests. The 11 October private sandbox checkpoint below supersedes the earlier absence of real Stripe test-mode transaction evidence.

Prepare privacy, terms, refund policy, support contact and accurate product descriptions for owner review. Confirm deletion, billing-record retention and analytics consent wording. Do not enable live credentials, publish, merge the draft PR or submit this configuration during preparation.

## Private sandbox and publisher checkpoint, 11 October 2026

The following evidence is from the authorised private Codespaces QA runtime using synthetic customers. No live Stripe keys or customer payments were used.

- Product `prod_VQFszq8dcJwoUa` and Price `price_1UPPN79CaxwiJ3dkCKahitbB` were verified as active, one-time GBP 199. The product and Price identifiers are not credentials.
- A successful Stripe sandbox payment returned to the signed-in synthetic account, a signed webhook received HTTP 200, and the Complete entitlement persisted after reload.
- A separate guest checkout was cancelled through the hosted payment page; the app returned without an entitlement and retained the existing guest tasks and plans.
- Provider-decline entry was blocked by automatic browser approval review because workspace credits were exhausted. No declined-payment outcome was captured. Do not bypass the blocked action through another interface.
- Duplicate webhook delivery, complete failed-payment recovery, the remaining return cases, refund lifecycle still require evidence. API regressions and one successful payment do not close the entire payment gate.
- CI #254 completed successfully at application head `7b23ba6f83589a3ce3a271f308adf71b1f7dbc22`. Later documentation commits are not new browser or transaction evidence.
- Publisher identity is Paul Lonergan trading as Tenaciouspl; customer support is `tenaciouspl@icloud.com`. The purchased promotional domain is `tenaciouspl.co.uk`. Domain purchase and publisher details do not establish approved legal/refund/retention terms or a production app origin.

Keep the private testing environment separate from the promotional landing page. The landing page collects no payments. Its publication is not approval to merge, deploy the app, leave maintenance mode or activate live Stripe.

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
4. Review the existing Render host, final application origin, billing owner, data region and acceptable total recurring cost. The promotional domain is already purchased and active. Confirm the current provider quote before any new spending; do not create a replacement service without approval.
5. Publisher/legal identity and support contact have been supplied as recorded above. Finish privacy/terms/refund content, analytics-consent wording, and account/billing data-retention rules; these are not approved merely by supplying a name and email.
6. Approve the production administrator allowlist, stable secret handling, persistent SQLite or PostgreSQL storage, off-host encrypted backup destination, retention schedule, restore rehearsal and responsible recovery owner.
7. Private sandbox credentials and the UK Complete Price are configured in the authorised QA environment. Finish the outstanding test-mode failure, return, replay, refund and entitlement checks listed above. The launch uses one £1.99 GBP Price only. Live credentials and activation require separate explicit approval.

Until these actions are complete, keep the preview private and the release unpublished.

## Remaining release gates

- Supported HTTPS preview and `BROWSER_QA_RUNBOOK.md` completed using synthetic data against application revision `00762a39046031ef46f944a059492301601cab37`.
- Actual iPad Safari checks, including keyboard, clipboard, account screens and checkout returns.
- One-time Docker build/start/restart and mounted-persistence check completed on 8 October; production configuration and operational recovery still require owner approval.
- **Pending:** current-revision browser acceptance of paid-access enforcement and the remaining real sandbox payment lifecycle cases listed above. Automated paid-access enforcement checks have passed.
- Test-only off-host encrypted backup and isolated restore rehearsal completed on 9 October; production backup key custody, recovery/retention and support/legal review remain pending.
- Owner approval of recurring cost, final domain, production settings and publication.

This document update made no new subscription, purchase, deployment or live-payment change. The existing Render service is separately verified above.
