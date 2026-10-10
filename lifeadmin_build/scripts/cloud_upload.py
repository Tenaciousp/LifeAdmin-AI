"""Optional encrypted-file-only upload to a separately configured rclone remote.

Not scheduled. Never deletes backups or reads plaintext customer data.
"""
import argparse
import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as file:
        while chunk := file.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def upload(backup, remote_folder):
    source = Path(backup).resolve(strict=True)
    if not source.is_file() or not source.name.endswith(".labak"):
        raise ValueError("Expected an existing .labak encrypted backup")
    if not remote_folder or ":" not in remote_folder or remote_folder.startswith(":"):
        raise ValueError("Expected configured rclone remote:folder")
    remote_name, path = remote_folder.split(":", 1)
    if not remote_name or not path or path.startswith("/") or ".." in path.split("/"):
        raise ValueError("Invalid remote folder")
    if shutil.which("rclone") is None:
        raise RuntimeError("Install and configure rclone separately")
    destination = remote_folder.rstrip("/") + "/" + source.name
    # Unique backup names required; do not overwrite remote objects.
    subprocess.run(["rclone", "copyto", "--ignore-existing", str(source), destination], check=True)
    with tempfile.TemporaryDirectory(prefix="lifeadmin-upload-check-") as temp:
        downloaded = Path(temp) / source.name
        with open(downloaded, "wb") as out:
            subprocess.run(["rclone", "cat", destination], stdout=out, check=True)
        if digest(downloaded) != digest(source):
            raise ValueError("Remote encrypted backup differs from source")
    print("Encrypted upload verified. No files deleted.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup")
    parser.add_argument("remote_folder")
    args = parser.parse_args()
    upload(args.backup, args.remote_folder)


if __name__ == "__main__":
    main()
