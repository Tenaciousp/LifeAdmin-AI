"""Start rclone OAuth from an iPad without copying its long terminal URL.

Run this only in the trusted development Codespace, with RCLONE_DRIVE_CLIENT_ID
and RCLONE_DRIVE_CLIENT_SECRET already exported in this terminal.
The private Codespaces relay must be running on port 53683.
The one-time authorisation link and rclone output are kept in owner-only /tmp
files, never printed or committed. Delete the files after completing setup.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

LINK = Path("/tmp/lifeadmin-rclone-auth-link")
OUTPUT = Path("/tmp/lifeadmin-rclone-authorize-output")
AUTH_PATTERN = re.compile(r"http://127[.]0[.]0[.]1:53682/auth[?]state=[^\s]+")
COMMAND = [
    "rclone", "authorize", "drive",
    "--drive-client-id", os.environ.get("RCLONE_DRIVE_CLIENT_ID", ""),
    "--drive-client-secret", os.environ.get("RCLONE_DRIVE_CLIENT_SECRET", ""),
    "--drive-scope", "drive.file",
    "--auth-no-open-browser",
]


def secure_file(path: Path) -> None:
    descriptor = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(descriptor, 0o600)
    os.close(descriptor)


def main() -> int:
    if not COMMAND[4] or not COMMAND[6]:
        print("Google client ID or secret is missing from this terminal.")
        print("Use the bash terminal where you originally entered both credentials.")
        return 1
    for path in (LINK, OUTPUT):
        secure_file(path)
    print("Starting private rclone Google sign-in. No URLs or tokens will be shown.")
    print("Keep this terminal running.")
    sys.stdout.flush()
    with OUTPUT.open("w", encoding="utf-8") as output:
        os.chmod(OUTPUT, 0o600)
        process = subprocess.Popen(
            COMMAND, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1,
        )
        assert process.stdout is not None
        ready = False
        for line in process.stdout:
            output.write(line)
            output.flush()
            match = AUTH_PATTERN.search(line)
            if match and not ready:
                LINK.write_text(match.group(0), encoding="utf-8")
                os.chmod(LINK, 0o600)
                ready = True
                print("READY: Return to the private helper page and tap the new Google sign-in link.")
                sys.stdout.flush()
        status = process.wait()
    if status == 0:
        print("Google authorisation finished. Private rclone output saved locally.")
        print("Do not share /tmp/lifeadmin-rclone-authorize-output in chat.")
    else:
        print("Rclone ended without completing authorisation. No tokens shown.")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
