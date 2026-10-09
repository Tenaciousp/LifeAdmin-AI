# LifeAdmin encrypted off-host backup: review-only implementation

Status: **NOT activated**, **NOT deployed**, **NOT scheduled**. No live customer data or credentials were accessed. This is not a production backup system.

## Added scripts

- `scripts/secure_backup.py`: AES-256-GCM encryption, SHA-256 manifest checks, SQLite integrity checks, and restore to a new directory.
- `scripts/cloud_upload.py`: optional encrypted-file-only rclone upload and full download verification. Requires separate rclone installation and OAuth configuration.
- `scripts/test_secure_backup.py`: offline synthetic-data tests.

The existing `scripts/backup_data.py` is unchanged.

## Local synthetic rehearsal only

Install `cryptography>=45,<47` in a disposable virtual environment. Generate a **new** random 32-byte key locally, encode it as 64 hex characters, and set `LIFEADMIN_BACKUP_KEY_HEX` without writing it into Git or a shared shell transcript. Never share a real key.

With a **synthetic** directory containing `lifeadmin.sqlite3`:

```sh
python scripts/secure_backup.py create /path/to/synthetic-data /tmp/synthetic.labak
python scripts/secure_backup.py verify /tmp/synthetic.labak
python scripts/secure_backup.py restore /tmp/synthetic.labak /tmp/synthetic-restored
python -m unittest discover -s scripts -p test_secure_backup.py
```

Cloud upload is optional and separate. After installing and configuring rclone for an approved private Drive account, manually upload **synthetic encrypted data only**:

```sh
python scripts/cloud_upload.py /tmp/synthetic.labak lifeadmin-drive:LifeAdmin-AI-Backups
```

Do not put Google OAuth credentials, encryption keys, account addresses, or access tokens in GitHub. Keep the recovery key outside the backup Drive account.

## Blocking gates before any production activation

1. **Write consistency:** Development code now coordinates API requests and `backup_data.py` using POSIX file locks. API requests wait briefly and receive HTTP 503 with Retry-After if an exclusive backup is in progress; liveness checks bypass the lock. Synthetic lock tests pass. **Still blocking production:** test the actual web server and Stripe webhook behavior under load, confirm every writer cooperates, confirm a single Render instance and one shared disk, and verify acceptable backup duration. This is not a distributed lock and does not cover noncooperating processes.
2. **Secret custody:** Establish a business-controlled secret store and independent offline recovery key. Verify a restore using the independently stored key.
3. **Cloud permissions:** Configure restricted OAuth/rclone access outside the public repository. The ChatGPT Google Drive connector cannot schedule backups on Render.
4. **Scheduler and retention:** Select a cost-approved scheduling mechanism, failure alerts, unique filenames, and a reviewed 30-day retention/deletion policy. No scheduler, cleanup, or remote deletion has been implemented.
5. **Space and recovery:** Confirm free space for plaintext temporary snapshots and encrypted output. Test full account, task, saved-plan, and purchase restoration against the matching application revision in an isolated environment. Never restore over production.
6. **Privacy:** Confirm account ownership, least-privilege permissions, access logs, data retention, and legal requirements before exporting production customer data.

`cloud_upload.py` verifies by downloading the full encrypted file; this consumes bandwidth and temporary disk space. It never deletes backups and does not clean up encrypted output automatically. Use unique backup names to prevent collisions.

**Do not add cryptography or rclone to the production Docker image or enable any job without separate review and approval.**

## Lock integration status (development only)

- `artifacts/api-server/backup_lock.py` implements shared request locks and exclusive snapshot locks using `fcntl.flock` on the persistent data directory.
- `artifacts/api-server/app.py` guards API GET/POST data paths including Stripe webhooks. Health checks remain independent. During backup contention, API requests receive HTTP 503 and Retry-After: 2.
- `scripts/backup_data.py` acquires an exclusive lock across SQLite backup, guest JSON copies and manifest creation. It fails rather than proceeding without the lock.
- `scripts/test_backup_lock.py` exercises contention, lock release after failure, concurrent readers, and file permissions with fictional records.
- No Render deployment, daily scheduler, Google credentials, retention deletion or production transfer was performed.
- The application currently uses a single instance. Do not scale to multiple instances without redesigning lock coordination.
