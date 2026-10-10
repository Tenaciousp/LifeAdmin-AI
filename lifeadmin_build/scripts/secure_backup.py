"""Offline encrypted LifeAdmin backup. NOT scheduled or connected to production.

Requires cryptography>=45,<47 and LIFEADMIN_BACKUP_KEY_HEX (64 hex characters).
Do not store the key in GitHub or the same cloud account as backups.
"""
import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import tarfile
import tempfile
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from backup_data import JSON_FILES, backup_data

MAGIC = b"LIFEADMIN-BACKUP-1\n"
CHUNK = 1024 * 1024
FILES = {"lifeadmin.sqlite3", "manifest.json", *JSON_FILES}


def secret_key():
    raw = os.environ.get("LIFEADMIN_BACKUP_KEY_HEX", "")
    try:
        key = bytes.fromhex(raw)
    except ValueError as exc:
        raise ValueError("Backup key must be 64 hexadecimal characters") from exc
    if len(raw) != 64 or len(key) != 32:
        raise ValueError("Backup key must be 64 hexadecimal characters")
    return key


def encrypt(source, output, key):
    nonce = os.urandom(12)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as dst, open(source, "rb") as src:
            dst.write(MAGIC + nonce)
            while block := src.read(CHUNK):
                dst.write(encryptor.update(block))
            dst.write(encryptor.finalize())
            dst.write(encryptor.tag)
    except BaseException:
        Path(output).unlink(missing_ok=True)
        raise


def decrypt(source, output, key):
    length = Path(source).stat().st_size
    if length < len(MAGIC) + 12 + 16:
        raise ValueError("Invalid encrypted backup")
    with open(source, "rb") as src:
        if src.read(len(MAGIC)) != MAGIC:
            raise ValueError("Invalid backup format")
        nonce = src.read(12)
        src.seek(-16, os.SEEK_END)
        tag = src.read(16)
        src.seek(len(MAGIC) + 12)
        remaining = length - len(MAGIC) - 12 - 16
        decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        with open(output, "xb") as dst:
            while remaining:
                block = src.read(min(CHUNK, remaining))
                if not block:
                    raise ValueError("Truncated backup")
                remaining -= len(block)
                dst.write(decryptor.update(block))
            dst.write(decryptor.finalize())


def validate_snapshot(directory):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text())
    if not isinstance(manifest, dict) or not manifest or set(manifest) - (FILES - {"manifest.json"}):
        raise ValueError("Invalid backup manifest")
    actual = {p.name for p in directory.iterdir()}
    if actual != set(manifest) | {"manifest.json"} or "lifeadmin.sqlite3" not in manifest:
        raise ValueError("Backup file set mismatch")
    for name, expected in manifest.items():
        if not isinstance(expected, str) or len(expected) != 64:
            raise ValueError("Invalid backup checksum")
        checksum = hashlib.sha256()
        with open(directory / name, "rb") as handle:
            while block := handle.read(CHUNK):
                checksum.update(block)
        if checksum.hexdigest() != expected:
            raise ValueError("Backup checksum mismatch")
    for name in JSON_FILES:
        if name in manifest:
            json.loads((directory / name).read_text())
    db = sqlite3.connect(f"file:{(directory / 'lifeadmin.sqlite3').as_posix()}?mode=ro", uri=True)
    try:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Restored database failed integrity check")
    finally:
        db.close()


def unpack_checked(archive, directory):
    with tarfile.open(archive, "r:") as tf:
        members = tf.getmembers()
        names = [m.name for m in members]
        if len(names) != len(set(names)) or not names or set(names) - FILES:
            raise ValueError("Unexpected archive entries")
        if any(not m.isfile() or m.size > 2 * 1024**3 for m in members):
            raise ValueError("Unsafe archive entry")
        for member in members:
            src = tf.extractfile(member)
            if src is None:
                raise ValueError("Unreadable archive entry")
            with open(Path(directory) / member.name, "xb") as dst:
                shutil.copyfileobj(src, dst, CHUNK)
    validate_snapshot(directory)


def create(data_dir, output):
    # Precondition: application writes must be stopped externally.
    # This script does NOT pause production writes.
    data_dir = Path(data_dir).resolve()
    output = Path(output).resolve()
    if output == data_dir or data_dir in output.parents:
        raise ValueError("Encrypted output must be outside the live data directory")
    if output.exists():
        raise FileExistsError(output)
    key = secret_key()
    with tempfile.TemporaryDirectory(prefix="lifeadmin-backup-") as tmp:
        snap = Path(tmp) / "snapshot"
        backup_data(data_dir, snap)
        validate_snapshot(snap)
        archive = Path(tmp) / "snapshot.tar"
        with tarfile.open(archive, "w:") as tf:
            for p in sorted(snap.iterdir()):
                tf.add(p, arcname=p.name, recursive=False)
        encrypt(archive, output, key)


def inspect(source, destination=None):
    key = secret_key()
    if destination is not None and Path(destination).exists():
        raise FileExistsError(destination)
    with tempfile.TemporaryDirectory(prefix="lifeadmin-restore-") as tmp:
        archive = Path(tmp) / "snapshot.tar"
        decrypt(source, archive, key)
        snap = Path(tmp) / "snapshot"
        snap.mkdir(mode=0o700)
        unpack_checked(archive, snap)
        if destination is not None:
            shutil.copytree(snap, destination, copy_function=shutil.copy2)
            for p in Path(destination).iterdir():
                p.chmod(0o600)
            Path(destination).chmod(0o700)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    make = sub.add_parser("create", help="Create backup only while writes are stopped")
    make.add_argument("data_dir")
    make.add_argument("output")
    verify = sub.add_parser("verify", help="Verify without restoring")
    verify.add_argument("backup")
    restore = sub.add_parser("restore", help="Restore to a NEW directory only")
    restore.add_argument("backup")
    restore.add_argument("destination")
    args = parser.parse_args()
    if args.action == "create":
        create(args.data_dir, args.output)
    elif args.action == "verify":
        inspect(args.backup)
    else:
        inspect(args.backup, args.destination)
    print(f"{args.action} completed successfully")


if __name__ == "__main__":
    main()
