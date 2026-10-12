"""Bounded asynchronous reset mail. Disabled until explicitly configured."""
from email.message import EmailMessage
import os
import queue
import smtplib
import ssl
import threading
from urllib.parse import urlparse

import storage
from backup_lock import data_lock

_jobs = queue.Queue(maxsize=32)
_worker_lock = threading.Lock()
_worker = None


def configured():
    origin = urlparse(os.environ.get("APP_BASE_URL", ""))
    return (os.environ.get("PASSWORD_RECOVERY_ENABLED", "").lower() == "true"
            and origin.scheme == "https" and bool(origin.hostname)
            and not origin.username and not origin.password
            and origin.path in ("", "/") and not origin.query and not origin.fragment
            and all(os.environ.get(key) for key in
                    ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM")))


def send_mail(recipient, subject, text):
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)
    # Implicit TLS only; certificate verification is mandatory.
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "465")),
                          timeout=10, context=ssl.create_default_context()) as smtp:
        smtp.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


def process_job(kind, email):
    if not configured():
        return
    if kind == "request":
        with data_lock(storage.DATA_DIR, timeout=0.5):
            issued = storage.issue_password_reset(email)
        if issued:
            recipient, token = issued
            # Fragment is not sent to web servers or included in referrer headers.
            link = os.environ["APP_BASE_URL"].rstrip("/") + "/#reset=" + token
            send_mail(recipient, "Reset your LifeAdmin password",
                      "Use this link within 30 minutes to reset your password:\n\n" + link +
                      "\n\nYour plans and paid access stay with your existing account. "
                      "If you did not request this email, ignore the link. "
                      "Never send your password to support.")
    elif kind == "changed":
        send_mail(email, "Your LifeAdmin password changed",
                  "Your password has changed and previous sessions have been signed out. "
                  "Your plans and paid access are unchanged. If you did not make this change, "
                  "contact tenaciouspl@icloud.com. Never send your password.")


def _run():
    while True:
        job = _jobs.get()
        try:
            process_job(*job)
        except Exception:
            # Never log recipient details, tokens, links or SMTP credentials.
            # Delivery/monitoring acceptance is required before activation.
            pass
        finally:
            _jobs.task_done()


def enqueue(kind, email):
    global _worker
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_run, daemon=True)
            _worker.start()
    try:
        _jobs.put_nowait((kind, email))
        return True
    except queue.Full:
        return False
