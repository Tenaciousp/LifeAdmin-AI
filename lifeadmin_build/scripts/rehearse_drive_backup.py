"""Manual end-to-end rehearsal of an encrypted backup using fictional records only.

Requires cryptography and a separately configured rclone remote with Drive
`drive.file` scope. Never reads application data, deletes Drive files, or
uses a production encryption key. NOT scheduled or production-ready.
"""
import argparse
import json
import os
import secrets
import sqlite3
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from cloud_upload import upload
from secure_backup import create, inspect


def rehearse(remote_folder):
    if not remote_folder or ":" not in remote_folder:
        raise ValueError("Specify a configured rclone remote:folder")
    with tempfile.TemporaryDirectory(prefix="lifeadmin-synthetic-drive-") as tmp:
        root = Path(tmp)
        data = root / "fictional-data"
        data.mkdir()
        with sqlite3.connect(data / "lifeadmin.sqlite3") as db:
            db.execute("CREATE TABLE fictional_accounts (email TEXT NOT NULL)")
            db.execute("INSERT INTO fictional_accounts VALUES (?)", ("fictional@example.invalid",))
        (data / "tasks.json").write_text(json.dumps([{"title": "Fictional task"}]))
        (data / "notes.json").write_text(json.dumps([{"title": "Fictional saved plan"}]))
        backup = root / f"synthetic-{uuid.uuid4().hex}.labak"
        # Disposable test key exists only in this process; never print or save it.
        with patch.dict(os.environ, {"LIFEADMIN_BACKUP_KEY_HEX": secrets.token_hex(32)}):
            create(data, backup)
            inspect(backup)
            upload(backup, remote_folder)  # rclone downloads and SHA-256 verifies.
            restored = root / "restored"
            inspect(backup, restored)
            with sqlite3.connect(restored / "lifeadmin.sqlite3") as db:
                assert db.execute("SELECT email FROM fictional_accounts").fetchone()[0] == "fictional@example.invalid"
            assert json.loads((restored / "notes.json").read_text())[0]["title"] == "Fictional saved plan"
    print("Synthetic encrypted upload and offline restore verified.")
    print("A uniquely named encrypted synthetic test object remains in the remote folder.")
    print("The disposable key was discarded; that remote test object cannot be restored.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("remote_folder", help="rclone remote:folder created by the restricted OAuth client")
    args = parser.parse_args()
    rehearse(args.remote_folder)


if __name__ == "__main__":
    main()
