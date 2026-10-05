"""Create a private local data backup; never uploads or overwrites a backup."""

import argparse
import hashlib
import json
import shutil
import sqlite3
from pathlib import Path


JSON_FILES = ("tasks.json", "notes.json", "settings.json", "purchases.json")


def backup_data(data_dir, destination):
    data_dir, destination = Path(data_dir).resolve(), Path(destination).resolve()
    database = data_dir / "lifeadmin.sqlite3"
    if not database.is_file():
        raise FileNotFoundError(database)
    if destination == data_dir or data_dir in destination.parents:
        raise ValueError("Store backups outside the live data directory")
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    try:
        target = destination / database.name
        target.touch(mode=0o600)
        with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as source:
            with sqlite3.connect(target) as copied:
                source.backup(copied)
                if copied.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("Database backup failed integrity check")
        for name in JSON_FILES:
            source = data_dir / name
            if source.exists():
                content = source.read_bytes()
                json.loads(content)
                copied = destination / name
                copied.touch(mode=0o600)
                copied.write_bytes(content)
        manifest = {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(destination.iterdir())
        }
        output = destination / "manifest.json"
        output.touch(mode=0o600)
        output.write_text(json.dumps(manifest, indent=2) + "\n")
        return destination
    except Exception:
        shutil.rmtree(destination)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir")
    parser.add_argument("destination")
    args = parser.parse_args()
    print(backup_data(args.data_dir, args.destination))
