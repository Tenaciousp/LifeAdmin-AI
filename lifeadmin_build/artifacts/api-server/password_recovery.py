"""Bounded asynchronous reset mail. Disabled until explicitly configured."""
from email.message import EmailMessage
import os
import logging
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
_logger = logging.getLogger(__name__)


def smtp_settings():
    mode = os.environ.get("SMTP_SECURITY", "ssl").lower()
    if mode not in ("ssl", "starttls"):
        raise ValueError("SMTP requires ssl or starttls")
    port = int(os.environ.get("SMTP_PORT") or ("587" if mode == "starttls" else "465"))
    if not 1 <= port <= 65535:
        raise ValueError("Invalid SMTP port")
    return mode, port


def configured():
    try:
        smtp_settings()
    except (ValueError, TypeError):
        return False
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
    mode, port = smtp_settings()
    context = ssl.create_default_context()
    if mode == "ssl":
        connection = smtplib.SMTP_SSL(os.environ["SMTP_HOST"], port, timeout=10, context=context)
    else:
        connection = smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=10)
    with connection as smtp:
        if mode == "starttls":
            smtp.ehlo()
            # An absent or failed TLS upgrade must abort before credentials are sent.
            smtp.starttls(context=context)
            smtp.ehlo()
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
            send_mail(recipient, "Reset your HomeAdmin password",
                      "Use this link within 30 minutes to reset your password:\n\n" + link +
                      "\n\nYour plans and paid access stay with your existing account. "
                      "If you did not request this email, ignore the link. "
                      "Never send your password to support.")
    elif kind == "changed":
        send_mail(email, "Your HomeAdmin password changed",
                  "Your password has changed and previous sessions have been signed out. "
                  "Your plans and paid access are unchanged. If you did not make this change, "
                  "contact tenaciouspl@icloud.com. Never send your password.")


def _run():
    while True:
        job = _jobs.get()
        try:
            process_job(*job)
        except Exception:
            # Fixed text only: provider exceptions often contain account details.
            _logger.warning("HomeAdmin password recovery delivery failed; sensitive details withheld.")
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
        _logger.warning("HomeAdmin password recovery queue is full; sensitive details withheld.")
        return False
