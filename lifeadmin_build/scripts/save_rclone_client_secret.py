#!/usr/bin/env python3
"""Update only the rclone Drive client secret, without invoking OAuth or logging it."""

import getpass
import os
from pathlib import Path
import re
import subprocess
import tempfile

REMOTE = "lifeadmin-drive"
SECTION = re.compile(r"^\s*\[([^\]]+)\]\s*$")
SECRET = re.compile(r"^(\s*client_secret\s*=).*$")


def main():
    result = subprocess.run(["rclone", "config", "file"], capture_output=True, text=True)
    if result.returncode:
        print("ERROR: Could not locate rclone configuration.")
        return 1
    config = Path(result.stdout.strip().splitlines()[-1].strip()).expanduser()
    if not config.is_file():
        print("ERROR: rclone configuration file not found.")
        return 1
    lines = config.read_text().splitlines(keepends=True)
    section = None
    found = False
    updated = False
    secret = getpass.getpass("Paste new Google client secret (hidden), then press Return: ")
    if not secret or "\n" in secret or "\r" in secret:
        print("ERROR: Secret must be a single non-empty line.")
        return 1
    for index, line in enumerate(lines):
        match = SECTION.match(line.strip())
        if match:
            section = match.group(1)
            if section == REMOTE:
                found = True
            continue
        if section == REMOTE and SECRET.match(line):
            lines[index] = SECRET.sub(lambda m: m.group(1) + " " + secret + "\n", line)
            updated = True
            break
    if not found:
        print("ERROR: Expected Drive remote is missing.")
        return 1
    if not updated:
        print("ERROR: Expected client_secret entry is missing; configuration unchanged.")
        return 1
    fd, temp_name = tempfile.mkstemp(prefix=".rclone-config-", dir=config.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            handle.writelines(lines)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, config)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    print("SUCCESS: New client secret saved privately. No Google sign-in was started.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
