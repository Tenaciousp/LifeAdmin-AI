# Local planning migration

The catalogue and search hooks use domain.mjs. Search requests no longer transmit
bill-search text to the API.

plans.mjs generates every current category, goal and planning mode locally,
preserving missing-detail prompts and the existing safety notices. Its
generateAndSaveLocalPlan function writes the complete result through the local
repository. Static playbooks are exported from the existing Python guidance by
scripts/export_offline_playbooks.py. Client rendering uses data only, with no
Python execution, hosted generation or external-AI fallback.
These generators are not yet connected to customer screens.

storage.mjs supplies the next migration stage: account-free IndexedDB storage for
bills and plans, with explicit backup export/import. This repository is not yet
connected to customer screens. Hosted tasks and plans still use the old API.
Do not remove account or purchase controls from the hosted flow as a shortcut.

## Storage contract

- Successful save promises resolve only after the entire transaction commits.
- Concurrent connections update records within read/write transactions.
- Deleting a bill deletes its associated saved plans in the same transaction.
- Backup replacement requires an explicit replace:true argument, after validation.
- Invalid, duplicate, orphaned, oversized and unsupported-version imports fail
  without clearing existing records. A write failure rolls back the replacement.
- The snapshot budget is 5 MB and at most 10,000 bills and 10,000 plans. Writes
  exceeding these limits fail without losing the previous exportable snapshot.
- Exports contain personal household information as plain JSON. The future UI must
  warn before exporting, use a customer-chosen destination, and never attach an
  export to support correspondence automatically.
- No network request, account identifier, telemetry or automatic upload is used.

## Remaining integration and acceptance

Connect this repository to the separate local customer flow together with local
plan generation, versioned data migration and backup controls. Explicit deletion
and import replacement need clear customer confirmation in those controls.

The tests use fake-indexeddb to exercise database transactions and fault rollback.
Reopening a connection in these tests is not proof of physical-device durability,
OS backup inclusion, native app upgrades or restoration after reinstall. Complete
those checks on the final Apple and Android packages before promising recovery.
Web builds use IndexedDB. Native builds select the app-private SQLite bridge;
see native/README.md. Native compilation, storage/backup integration and physical
device durability still need verification. Preserve existing server records throughout migration.

Run from lifeadmin_build after npm ci:

    node --test artifacts/adminpilot-ai/src/lib/offline/storage.test.mjs

The Python test suite also invokes these nine storage checks. Native releases and
any change to production access, payment or hosting settings need release review.

Energy and result-contract tests compare local output with the existing Python
functions. Coverage includes 49 billing-period pairs, all 84 category/goal
missing-detail combinations, 252 category/goal/provider scenarios, all eight
planning modes, named subscriptions, water, legacy routes, safety notices and
local generation/save/restore. A drift check compares bundled playbooks with source.
This checks behaviour preservation, not the freshness of provider policies or
official guidance; review time-sensitive guidance before release.
