"""One-command, private Codespaces rclone Drive reconnection for an iPad.

Use only in the owner's trusted development Codespace after configuring the
lifeadmin-drive: remote. The Google client credentials stay in rclone config;
no environment variables, token copy/paste, or shared rclone client are needed.

Keep the private relay running on 127.0.0.1:53683 and forward only 53683 as
Private. Never forward 53682. In the helper tap /begin after READY, approve
Google, and privately relay the full failed localhost callback via /finish.

No authorization URLs, Google codes, tokens or credentials are printed/logged.
"""
from __future__ import annotations

import os
import re
import socket
import stat
import subprocess
from pathlib import Path

REMOTE = "lifeadmin-drive:"
LINK = Path("/tmp/lifeadmin-rclone-auth-link")
AUTH_PATTERN = re.compile(r"http://127[.]0[.]0[.]1:53682/auth[?]state=[^\s]+")


def listener_active(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def write_private_link(value: str) -> None:
    """Write the current link only to an owner-controlled regular file."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    flags |= getattr(os, "O_NOFOLLOW", 0)
    if LINK.exists() or LINK.is_symlink():
        details = LINK.lstat()
        if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
            raise OSError("Unsafe existing link file")
    descriptor = os.open(str(LINK), flags, 0o600)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(value + "\n")
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        raise


def clear_link() -> None:
    try:
        if LINK.is_file() and not LINK.is_symlink() and LINK.stat().st_uid == os.getuid():
            LINK.unlink()
    except OSError:
        pass


def main() -> int:
    if listener_active(53682):
        print("An rclone sign-in session is already active. Do not start a second one.")
        print("Finish or cancel the existing session first, then retry once.")
        return 2
    if not listener_active(53683):
        print("Private sign-in helper is not running on local port 53683.")
        return 2
    try:
        remotes = subprocess.run(
            ["rclone", "listremotes"], capture_output=True, text=True, timeout=15,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        print("Unable to check rclone. Confirm it is installed in this Codespace.")
        return 2
    if remotes.returncode or REMOTE not in remotes.stdout.splitlines():
        print("Configured lifeadmin-drive: remote was not found. No changes made.")
        return 2

    clear_link()
    print("Starting one private Google Drive reconnect session.")
    print("Keep this terminal open; do not forward port 53682.", flush=True)
    try:
        process = subprocess.Popen(
            ["rclone", "config", "reconnect", REMOTE],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
        assert process.stdin is not None and process.stdout is not None
        # rclone 1.60 prompts twice: first for browser auth (yes), then
        # after OAuth for Shared Drive configuration (no). Closing stdin
        # after only the first answer makes the second prompt fail at EOF.
        # This rehearsal uses a personal, app-scoped Drive remote.
        process.stdin.write("y\nn\n")
        process.stdin.flush()
        process.stdin.close()
        ready = False
        for line in process.stdout:
            match = AUTH_PATTERN.search(line)
            if match and not ready:
                write_private_link(match.group(0))
                ready = True
                print("READY: In the private 53683 helper, tap 'Open Google sign-in without copying a terminal link'.", flush=True)
        status = process.wait()
        if status != 0 or not ready:
            print("Google authorisation did not finish. No credentials were displayed.")
            return 1
        verified = subprocess.run(
            ["rclone", "lsd", REMOTE], capture_output=True,
            text=True, timeout=30, check=False,
        )
        if verified.returncode != 0:
            print("Authorisation returned, but Drive access is not yet verified.")
            return 1
        print("SUCCESS: Google Drive remote connected and list verified.")
        return 0
    except (OSError, subprocess.TimeoutExpired):
        print("Reconnect could not be completed. No secrets were printed.")
        return 1
    finally:
        clear_link()


if __name__ == "__main__":
    raise SystemExit(main())
