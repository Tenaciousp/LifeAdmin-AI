"""Portable account and persistence layer for LifeAdmin AI.

PostgreSQL is used when DATABASE_URL is configured. For zero-config local and
small-host deployments, the app falls back to SQLite in the API data folder.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator
from contextlib import contextmanager

try:  # PostgreSQL is optional for local/free deployments.
    import psycopg  # type: ignore
    from psycopg.types.json import Jsonb  # type: ignore
except ImportError:  # pragma: no cover - exercised implicitly in SQLite environments
    psycopg = None
    Jsonb = None


SESSION_DAYS = 30
DATA_DIR = Path(__file__).resolve().parent / "data"
SQLITE_PATH = Path(os.environ.get("SQLITE_DB_PATH") or DATA_DIR / "lifeadmin.sqlite3")


class StorageUnavailable(RuntimeError):
    pass


def backend() -> str:
    if os.environ.get("DATABASE_URL"):
        return "postgresql" if psycopg is not None else "unavailable"
    return "sqlite"


def available() -> bool:
    return backend() in {"postgresql", "sqlite"}


def connect():
    """Return a PostgreSQL connection when DATABASE_URL is configured."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise StorageUnavailable("PostgreSQL is not configured")
    if psycopg is None:
        raise StorageUnavailable("PostgreSQL support is not installed; install psycopg or remove DATABASE_URL to use SQLite")
    return psycopg.connect(url)


@contextmanager
def sqlite_connect() -> Iterator[sqlite3.Connection]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH, timeout=30)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_schema() -> bool:
    """Create the minimal persistence schema for the selected backend."""
    mode = backend()
    if mode == "unavailable":
        raise StorageUnavailable("DATABASE_URL is set but psycopg is unavailable")
    if mode == "postgresql":
        statements = [
            """CREATE TABLE IF NOT EXISTS adminpilot_users (
                   id UUID PRIMARY KEY,
                   email TEXT NOT NULL UNIQUE,
                   password_hash TEXT NOT NULL,
                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
               )""",
            """CREATE TABLE IF NOT EXISTS adminpilot_sessions (
                   token_hash TEXT PRIMARY KEY,
                   user_id UUID NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                   expires_at TIMESTAMPTZ NOT NULL,
                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
               )""",
            """CREATE TABLE IF NOT EXISTS adminpilot_tasks (
                   id UUID PRIMARY KEY,
                   user_id UUID NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                   payload JSONB NOT NULL,
                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
               )""",
            """CREATE TABLE IF NOT EXISTS adminpilot_notes (
                   id UUID PRIMARY KEY,
                   user_id UUID NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                   payload JSONB NOT NULL,
                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
               )""",
            """CREATE TABLE IF NOT EXISTS adminpilot_purchases (
                   user_id UUID NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                   product_id TEXT NOT NULL,
                   source TEXT NOT NULL,
                   session_id TEXT,
                   unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                   PRIMARY KEY (user_id, product_id)
               )""",
            "CREATE INDEX IF NOT EXISTS idx_adminpilot_sessions_user ON adminpilot_sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_adminpilot_sessions_expiry ON adminpilot_sessions(expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_adminpilot_tasks_user_updated ON adminpilot_tasks(user_id, updated_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_adminpilot_notes_user_created ON adminpilot_notes(user_id, created_at DESC)",
        ]
        with connect() as conn:
            with conn.cursor() as cur:
                for statement in statements:
                    cur.execute(statement)
                cur.execute("DELETE FROM adminpilot_sessions WHERE expires_at <= NOW()")
        return True

    with sqlite_connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS adminpilot_users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS adminpilot_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS adminpilot_tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS adminpilot_notes (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS adminpilot_purchases (
                user_id TEXT NOT NULL REFERENCES adminpilot_users(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL,
                source TEXT NOT NULL,
                session_id TEXT,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (user_id, product_id)
            );
            CREATE INDEX IF NOT EXISTS idx_adminpilot_sessions_user ON adminpilot_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_adminpilot_sessions_expiry ON adminpilot_sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_adminpilot_tasks_user_updated ON adminpilot_tasks(user_id, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_adminpilot_notes_user_created ON adminpilot_notes(user_id, created_at DESC);
            """
        )
        conn.execute("DELETE FROM adminpilot_sessions WHERE expires_at <= ?", (_now_iso(),))
    return True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _password_hash(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return f"pbkdf2_sha256$600000${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def _password_matches(password: str, encoded: str) -> bool:
    try:
        name, rounds, salt_b64, expected_b64 = encoded.split("$", 3)
        if name != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(expected_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def validate_credentials(email: str, password: str) -> str:
    email = normalize_email(email)
    if "@" not in email or len(email) > 254:
        raise ValueError("Enter a valid email address")
    if len(password or "") < 10:
        raise ValueError("Password must be at least 10 characters")
    if len(password or "") > 256:
        raise ValueError("Password is too long")
    return email


def create_user(email: str, password: str) -> dict[str, str]:
    email = validate_credentials(email, password)
    user_id = str(uuid.uuid4())
    created_at = _now_iso()
    if backend() == "postgresql":
        try:
            with connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO adminpilot_users (id, email, password_hash) VALUES (%s, %s, %s)",
                        (user_id, email, _password_hash(password)),
                    )
        except psycopg.errors.UniqueViolation as exc:  # type: ignore[union-attr]
            raise ValueError("An account already exists for this email") from exc
    else:
        ensure_schema()
        try:
            with sqlite_connect() as conn:
                conn.execute(
                    "INSERT INTO adminpilot_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (user_id, email, _password_hash(password), created_at),
                )
        except sqlite3.IntegrityError as exc:
            raise ValueError("An account already exists for this email") from exc
    return {"id": user_id, "email": email}


def authenticate(email: str, password: str) -> dict[str, str]:
    email = normalize_email(email)
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, email, password_hash FROM adminpilot_users WHERE email = %s", (email,))
                row = cur.fetchone()
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            row = conn.execute("SELECT id, email, password_hash FROM adminpilot_users WHERE email = ?", (email,)).fetchone()
    if not row or not _password_matches(password or "", row[2]):
        raise ValueError("Email or password is incorrect")
    return {"id": str(row[0]), "email": row[1]}


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=SESSION_DAYS)
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO adminpilot_sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
                    (token_hash, user_id, expires),
                )
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            conn.execute(
                "INSERT INTO adminpilot_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                (token_hash, user_id, expires.isoformat(), now.isoformat()),
            )
    return token


def user_for_session(token: str | None) -> dict[str, str] | None:
    if not token or not available():
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT u.id, u.email
                       FROM adminpilot_sessions s
                       JOIN adminpilot_users u ON u.id = s.user_id
                       WHERE s.token_hash = %s AND s.expires_at > NOW()""",
                    (token_hash,),
                )
                row = cur.fetchone()
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            row = conn.execute(
                """SELECT u.id, u.email
                   FROM adminpilot_sessions s
                   JOIN adminpilot_users u ON u.id = s.user_id
                   WHERE s.token_hash = ? AND s.expires_at > ?""",
                (token_hash, _now_iso()),
            ).fetchone()
    return {"id": str(row[0]), "email": row[1]} if row else None


def delete_session(token: str | None) -> None:
    if not token or not available():
        return
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM adminpilot_sessions WHERE token_hash = %s", (token_hash,))
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            conn.execute("DELETE FROM adminpilot_sessions WHERE token_hash = ?", (token_hash,))


def delete_account(user_id: str, password: str) -> None:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT password_hash FROM adminpilot_users WHERE id = %s", (user_id,))
                row = cur.fetchone()
                if not row or not _password_matches(password or "", row[0]):
                    raise ValueError("Password is incorrect")
                cur.execute("DELETE FROM adminpilot_users WHERE id = %s", (user_id,))
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            row = conn.execute("SELECT password_hash FROM adminpilot_users WHERE id = ?", (user_id,)).fetchone()
            if not row or not _password_matches(password or "", row[0]):
                raise ValueError("Password is incorrect")
            conn.execute("DELETE FROM adminpilot_users WHERE id = ?", (user_id,))


def list_tasks(user_id: str) -> list[dict[str, Any]]:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT payload FROM adminpilot_tasks WHERE user_id = %s ORDER BY updated_at DESC", (user_id,))
                return [row[0] for row in cur.fetchall()]
    ensure_schema()
    with sqlite_connect() as conn:
        rows = conn.execute("SELECT payload FROM adminpilot_tasks WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)).fetchall()
    return [json.loads(row[0]) for row in rows]


def create_task(user_id: str, task: dict[str, Any]) -> None:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO adminpilot_tasks (id, user_id, payload) VALUES (%s, %s, %s)", (task["id"], user_id, Jsonb(task)))
    else:
        ensure_schema()
        now = _now_iso()
        with sqlite_connect() as conn:
            conn.execute(
                "INSERT INTO adminpilot_tasks (id, user_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (task["id"], user_id, json.dumps(task), now, now),
            )


def update_task(user_id: str, task_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT payload FROM adminpilot_tasks WHERE user_id = %s AND id = %s", (user_id, task_id))
                row = cur.fetchone()
                if not row:
                    return None
                task = row[0]
                task.update(changes)
                cur.execute("UPDATE adminpilot_tasks SET payload = %s, updated_at = NOW() WHERE user_id = %s AND id = %s", (Jsonb(task), user_id, task_id))
                return task
    ensure_schema()
    with sqlite_connect() as conn:
        row = conn.execute("SELECT payload FROM adminpilot_tasks WHERE user_id = ? AND id = ?", (user_id, task_id)).fetchone()
        if not row:
            return None
        task = json.loads(row[0])
        task.update(changes)
        conn.execute("UPDATE adminpilot_tasks SET payload = ?, updated_at = ? WHERE user_id = ? AND id = ?", (json.dumps(task), _now_iso(), user_id, task_id))
        return task


def delete_task(user_id: str, task_id: str) -> bool:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM adminpilot_tasks WHERE user_id = %s AND id = %s", (user_id, task_id))
                return cur.rowcount > 0
    ensure_schema()
    with sqlite_connect() as conn:
        cur = conn.execute("DELETE FROM adminpilot_tasks WHERE user_id = ? AND id = ?", (user_id, task_id))
        return cur.rowcount > 0


def add_note(user_id: str, note: dict[str, Any]) -> None:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO adminpilot_notes (id, user_id, payload) VALUES (%s, %s, %s)", (note["id"], user_id, Jsonb(note)))
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            conn.execute("INSERT INTO adminpilot_notes (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)", (note["id"], user_id, json.dumps(note), _now_iso()))


def list_notes(user_id: str) -> list[dict[str, Any]]:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT payload FROM adminpilot_notes WHERE user_id = %s ORDER BY created_at DESC LIMIT 200", (user_id,))
                return [row[0] for row in cur.fetchall()]
    ensure_schema()
    with sqlite_connect() as conn:
        rows = conn.execute("SELECT payload FROM adminpilot_notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 200", (user_id,)).fetchall()
    return [json.loads(row[0]) for row in rows]


def get_purchases(user_id: str) -> dict[str, bool]:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT product_id FROM adminpilot_purchases WHERE user_id = %s", (user_id,))
                return {row[0]: True for row in cur.fetchall()}
    ensure_schema()
    with sqlite_connect() as conn:
        rows = conn.execute("SELECT product_id FROM adminpilot_purchases WHERE user_id = ?", (user_id,)).fetchall()
    return {row[0]: True for row in rows}


def unlock_purchase(user_id: str, product_id: str, source: str, session_id: str | None = None) -> None:
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO adminpilot_purchases (user_id, product_id, source, session_id)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (user_id, product_id)
                       DO UPDATE SET source = EXCLUDED.source, session_id = EXCLUDED.session_id, unlocked_at = NOW()""",
                    (user_id, product_id, source, session_id),
                )
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            conn.execute(
                """INSERT INTO adminpilot_purchases (user_id, product_id, source, session_id, unlocked_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, product_id)
                   DO UPDATE SET source = excluded.source, session_id = excluded.session_id, unlocked_at = excluded.unlocked_at""",
                (user_id, product_id, source, session_id, _now_iso()),
            )


def admin_overview() -> dict[str, Any]:
    """Return aggregate operational metrics without exposing task/note contents."""
    if backend() == "postgresql":
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM adminpilot_users")
                users = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE COALESCE(payload->>'status', 'Open') <> 'Done'), COUNT(*) FILTER (WHERE payload->>'status' = 'Done') FROM adminpilot_tasks")
                task_total, task_open, task_done = cur.fetchone()
                cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE payload->>'source' = 'fallback'), COUNT(*) FILTER (WHERE payload->>'source' = 'openai') FROM adminpilot_notes")
                note_total, fallback, ai = cur.fetchone()
                cur.execute("SELECT product_id, COUNT(*) FROM adminpilot_purchases GROUP BY product_id")
                purchases = {row[0]: row[1] for row in cur.fetchall()}
                cur.execute("SELECT payload->>'category_id', COUNT(*) FROM adminpilot_tasks GROUP BY payload->>'category_id'")
                categories = {row[0] or "unknown": row[1] for row in cur.fetchall()}
                cur.execute("SELECT payload->>'goal_id', COUNT(*) FROM adminpilot_tasks GROUP BY payload->>'goal_id'")
                goals = {row[0] or "unspecified": row[1] for row in cur.fetchall()}
                cur.execute("SELECT COALESCE(payload->>'category_id', payload->>'category'), created_at FROM adminpilot_tasks ORDER BY created_at DESC LIMIT 20")
                recent_activity = [{"type": "task", "category": row[0] or "other_regular_payment", "time": row[1].isoformat() if row[1] else None} for row in cur.fetchall()]
    else:
        ensure_schema()
        with sqlite_connect() as conn:
            users = conn.execute("SELECT COUNT(*) FROM adminpilot_users").fetchone()[0]
            task_rows = conn.execute("SELECT payload, created_at FROM adminpilot_tasks ORDER BY created_at DESC").fetchall()
            note_rows = conn.execute("SELECT payload FROM adminpilot_notes").fetchall()
            purchase_rows = conn.execute("SELECT product_id, COUNT(*) AS count FROM adminpilot_purchases GROUP BY product_id").fetchall()
        tasks = [json.loads(row[0]) for row in task_rows]
        notes = [json.loads(row[0]) for row in note_rows]
        task_total = len(tasks)
        task_open = sum(1 for item in tasks if item.get("status", "Open") != "Done")
        task_done = sum(1 for item in tasks if item.get("status") == "Done")
        note_total = len(notes)
        fallback = sum(1 for item in notes if item.get("source") == "fallback")
        ai = sum(1 for item in notes if item.get("source") == "openai")
        purchases = {row[0]: row[1] for row in purchase_rows}
        categories: dict[str, int] = {}
        goals: dict[str, int] = {}
        for item in tasks:
            category = item.get("category_id") or "unknown"
            goal = item.get("goal_id") or "unspecified"
            categories[category] = categories.get(category, 0) + 1
            goals[goal] = goals.get(goal, 0) + 1
        recent_activity = [
            {"type": "task", "category": item.get("category_id") or item.get("category") or "other_regular_payment", "time": row[1]}
            for item, row in zip(tasks[:20], task_rows[:20])
        ]
    return {
        "users": {"total": users},
        "tasks": {"total": task_total, "open": task_open, "completed": task_done},
        "plans": {"total": note_total, "fallback": fallback, "ai": ai},
        "purchases": {"entitlement_records": sum(purchases.values()), "core": purchases.get("core_app", 0), "all_access": purchases.get("all_access", 0)},
        "categories": categories,
        "goals": goals,
        "recent_activity": recent_activity,
    }
