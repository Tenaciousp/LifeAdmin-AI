"""Cross-process coordination for LifeAdmin data requests and local snapshots.

Linux/POSIX flock; supported only when the web process and backup process
share one filesystem. Not a distributed lock for multiple Render instances.
"""
import fcntl
import os
import time
from contextlib import contextmanager
from pathlib import Path


class LockTimeout(TimeoutError):
    """Could not acquire the data lock before the deadline."""


@contextmanager
def data_lock(data_dir, *, exclusive=False, timeout=30.0):
    if timeout < 0:
        raise ValueError("Lock timeout must be nonnegative")
    directory = Path(data_dir).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(directory / ".lifeadmin-data.lock", flags, 0o600)
    acquired = False
    try:
        os.fchmod(fd, 0o600)
        mode = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
        deadline = time.monotonic() + timeout
        while True:
            try:
                fcntl.flock(fd, mode | fcntl.LOCK_NB)
                acquired = True
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise LockTimeout("LifeAdmin data lock unavailable")
                time.sleep(min(0.05, max(0, deadline - time.monotonic())))
        yield
    finally:
        if acquired:
            fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)
