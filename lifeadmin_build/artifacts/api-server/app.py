#!/usr/bin/env python3
"""
LifeAdmin AI by AdminPilot - sellable MVP
A privacy-light personal admin agent for household admin, renewals, bills and everyday document tasks.
Run: python app.py
Optional: export OPENAI_API_KEY="..." for AI-generated outputs.
Optional: export STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and Stripe Price IDs for live web payments.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urlencode
import json
import os
import secrets
import threading
import uuid
import time
import hmac
import hashlib
import re
from datetime import datetime, timezone, timedelta
from http.cookies import SimpleCookie
import urllib.request
import urllib.error

import storage
import domain

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "data")
WEB_DIR = os.environ.get("WEB_DIR") or os.path.abspath(os.path.join(APP_DIR, "..", "adminpilot-ai", "dist", "public"))
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")
NOTES_FILE = os.path.join(DATA_DIR, "notes.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
PURCHASES_FILE = os.path.join(DATA_DIR, "purchases.json")
_JSON_LOCK = threading.RLock()

def _load_session_secret():
    configured = os.environ.get("SESSION_SECRET")
    if configured:
        return configured.encode("utf-8")
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, ".session_secret")
    try:
        if os.path.exists(path):
            with open(path, "rb") as handle:
                existing = handle.read().strip()
                if len(existing) >= 32:
                    return existing
        generated = secrets.token_urlsafe(48).encode("utf-8")
        with open(path, "wb") as handle:
            handle.write(generated)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        return generated
    except OSError:
        return secrets.token_urlsafe(48).encode("utf-8")

_SESSION_SECRET = _load_session_secret()

SYSTEM_PROMPT = """You are LifeAdmin AI, a practical personal admin assistant for household admin, renewals, bills, documents, travel preparation and small business admin.
Write concise, safe, actionable outputs. Do not claim to take real-world actions. Do not send messages, make purchases, cancel accounts, access external services, or imply professional legal, medical, tax, insurance or financial advice.
Always keep a human approval checkpoint before any real-world action. Focus on checklists, draft wording, reminders, comparison criteria, risk flags and next steps.
Return exactly these four Markdown H2 sections in this order: Next steps, Provider message, Things to check, Approval checklist. Put genuine provider-ready draft wording only under Provider message. If no provider message is useful, leave that section empty. Do not invent additional H2 headings.
For regulated topics, provide general information and advise checking official sources or qualified professionals.
"""

DEFAULT_TASKS = []

CATEGORY_PROMPTS = {
    "Renewal": "Create a renewal review plan, negotiation script, information checklist and decision criteria.",
    "Bill check": "Create a bill checking plan, comparison criteria, possible savings questions and a safe action checklist.",
    "Email draft": "Draft a concise email, subject line, follow-up plan and approval checklist.",
    "Document task": "Create a document review checklist, missing information list, risks and next actions.",
    "Travel admin": "Create a travel admin checklist with documents, dates, booking checks and follow-up reminders.",
    "General": "Create a practical admin action plan, draft text if relevant, and next steps."
}

CORE_PRODUCT = {
    "id": "core_app",
    "name": "LifeAdmin AI Core",
    "price": "£0.99 / $0.99",
    "amount_pence": 99,
    "billing": "one-time",
    "description": "Create household admin plans, basic email drafts and daily task lists.",
    "price_env": "STRIPE_PRICE_CORE_APP",
    "apple_product_id": os.environ.get("APPLE_PRODUCT_CORE", "com.adminpilot.lifeadmin.core"),
    "google_product_id": os.environ.get("GOOGLE_PRODUCT_CORE", "lifeadmin_core"),
}

ALL_ACCESS_PRODUCT = {
    "id": "all_access",
    "name": "All Access Pack",
    "price": "£1.99 / $1.99",
    "amount_pence": 199,
    "billing": "one-time",
    "price_env": "STRIPE_PRICE_ALL_ACCESS",
    "apple_product_id": os.environ.get("APPLE_PRODUCT_ALL_ACCESS", "com.adminpilot.lifeadmin.allaccess"),
    "google_product_id": os.environ.get("GOOGLE_PRODUCT_ALL_ACCESS", "lifeadmin_all_access"),
    "description": "Unlock advanced plans, specialist outputs and every additional LifeAdmin planning mode in this release.",
}
ADD_ONS = [ALL_ACCESS_PRODUCT]
ADVANCED_MODES = {"more_options", "renewal_pro", "refund_pro", "document_pro", "travel_pro", "family_board", "small_landlord"}
MODE_REQUIREMENTS = {mode: ALL_ACCESS_PRODUCT["id"] for mode in ADVANCED_MODES}
LEGACY_ALL_ACCESS_PRODUCTS = ADVANCED_MODES | {"all_packs"}
VALID_PRODUCTS = {CORE_PRODUCT["id"]} | {item["id"] for item in ADD_ONS}

MODE_PROMPTS = {
    "full": "Create one clear admin plan with next steps, a draft message when useful and an approval checklist.",
    "more_options": "Create three options: quick route, balanced route and thorough route. Include pros, cons, time needed and best fit.",
    "renewal_pro": "Create a renewal saving plan, comparison checklist, negotiation script, cancellation risk check and final decision grid.",
    "refund_pro": "Create a refund or complaint plan with subject lines, first email, follow-up email and escalation wording.",
    "document_pro": "Create a document review plan, missing evidence checklist, official-source checks and approval notes.",
    "travel_pro": "Create a travel admin plan with booking checks, document checks, insurance checks, deadlines and day-before list.",
    "family_board": "Create a weekly family admin board with owners, priorities, due dates, reminders and review rhythm.",
    "small_landlord": "Create a small landlord admin plan with maintenance log, tenant communication draft and compliance reminder. Avoid legal advice."
}

QA_REPORT = {
    "updated": "21 September 2026",
    "progress_note": "Database accounts, per-user data isolation, deletion controls, legal screens and store QA are implemented.",
    "passed": [
        "Six task-specific playbooks produce distinct plans",
        "Streaming checklist includes provider, store, renewal, cancellation and refund checks",
        "Ambiguous renewal wording stays with insurance, travel, document, refund or bill context",
        "Every advanced mode adds substantive specialist output behind one All Access entitlement",
        "Core 99p/99c and All Access £1.99/$1.99 pricing, Stripe checkout, demo unlocks and privacy-light workflow remain intact",
        "PostgreSQL account storage and account/data deletion flow are available",
        "Privacy, terms, mobile accessibility and store-listing guidance are included"
    ],
    "failed": [],
    "blocked": [
        "Native iOS and Android packages require the mobile artifact build",
        "Apple and Google signing, store billing and submission require owner developer accounts",
        "Final privacy disclosures require the owner's legal/business contact details"
    ]
}


def env_bool(name, default=False):
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def ensure_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(TASKS_FILE):
        write_json(TASKS_FILE, DEFAULT_TASKS)
    if not os.path.exists(NOTES_FILE):
        write_json(NOTES_FILE, [])
    if not os.path.exists(SETTINGS_FILE):
        write_json(SETTINGS_FILE, {
            "brand_name": "LifeAdmin AI",
            "plan": "Core",
            "currency": "GBP",
            "entry_price": "0.99 GBP",
            "payments": "stripe_checkout_ready"
        })
    if not os.path.exists(PURCHASES_FILE):
        write_json(PURCHASES_FILE, {"users": {}, "stripe_sessions": {}})
    else:
        migrate_purchases()


def read_json(path, default):
    with _JSON_LOCK:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default


def write_json(path, data):
    with _JSON_LOCK:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + f".{threading.get_ident()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, path)


def anonymous_items(path, user_id, defaults=None):
    """Return an isolated anonymous workspace keyed by the browser's opaque ID."""
    with _JSON_LOCK:
        store = read_json(path, {})
        if not isinstance(store, dict) or not isinstance(store.get("users"), dict):
            store = {"users": {}}
        key = safe_user_id(user_id)
        if key not in store["users"]:
            store["users"][key] = json.loads(json.dumps(defaults or []))
            write_json(path, store)
        return store["users"][key]


def save_anonymous_items(path, user_id, items):
    with _JSON_LOCK:
        store = read_json(path, {})
        if not isinstance(store, dict) or not isinstance(store.get("users"), dict):
            store = {"users": {}}
        store["users"][safe_user_id(user_id)] = items
        write_json(path, store)


def migrate_guest_workspace(guest_id, user_id):
    """Claim guest work and entitlements when a visitor creates an account."""
    if not storage.available():
        return
    for path, writer in ((TASKS_FILE, storage.create_task), (NOTES_FILE, storage.add_note)):
        items = anonymous_items(path, guest_id)
        for item in items:
            try:
                writer(user_id, item)
            except Exception:
                continue
        save_anonymous_items(path, guest_id, [])

    guest_entitlements = get_user_purchases(guest_id)
    for product_id, enabled in guest_entitlements.items():
        if enabled and product_id in VALID_PRODUCTS:
            try:
                storage.unlock_purchase(user_id, product_id, "guest_migration")
            except Exception:
                continue
    purchase_store = load_purchase_store()
    purchase_store.get("users", {}).pop(safe_user_id(guest_id), None)
    write_json(PURCHASES_FILE, purchase_store)


def migrate_purchases():
    data = read_json(PURCHASES_FILE, {})
    if "users" in data:
        return data
    flat = {k: v for k, v in data.items() if isinstance(v, bool)}
    if not flat:
        flat = {"core_app": True}
    migrated = {"users": {"legacy": flat}, "stripe_sessions": {}}
    write_json(PURCHASES_FILE, migrated)
    return migrated


def safe_user_id(user_id):
    user_id = str(user_id or "demo").strip()
    allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
    user_id = "".join(ch for ch in user_id if ch in allowed)[:80]
    return user_id or "demo"


def guest_session(handler):
    """Return a server-issued guest ID; never trust a caller-provided workspace ID."""
    cookie = SimpleCookie()
    try:
        cookie.load(handler.headers.get("Cookie", ""))
        token = cookie.get("lifeadmin_guest")
        if token:
            raw, sep, signature = token.value.partition(".")
            expected = hmac.new(_SESSION_SECRET, raw.encode(), hashlib.sha256).hexdigest()
            if sep and hmac.compare_digest(signature, expected):
                return safe_user_id(raw)
    except Exception:
        pass
    raw = uuid.uuid4().hex
    token = f"{raw}.{hmac.new(_SESSION_SECRET, raw.encode(), hashlib.sha256).hexdigest()}"
    handler._guest_cookie = session_cookie(handler, token, name="lifeadmin_guest")
    return raw


def is_database_user(user_id):
    try:
        uuid.UUID(str(user_id))
        return storage.available()
    except (ValueError, TypeError, AttributeError):
        return False


def session_token(handler):
    cookie = SimpleCookie()
    try:
        cookie.load(handler.headers.get("Cookie", ""))
        return cookie["adminpilot_session"].value if "adminpilot_session" in cookie else None
    except Exception:
        return None


def current_user(handler):
    try:
        return storage.user_for_session(session_token(handler))
    except Exception:
        return None


def effective_user_id(handler, supplied="demo"):
    user = current_user(handler)
    return user["id"] if user else guest_session(handler)


def load_purchase_store():
    data = read_json(PURCHASES_FILE, {"users": {}, "stripe_sessions": {}})
    if "users" not in data:
        data = migrate_purchases()
    data.setdefault("users", {})
    data.setdefault("stripe_sessions", {})
    return data


def normalized_entitlements(purchases):
    purchases = purchases or {}
    entitlements = {}
    if purchases.get("core_app"):
        entitlements["core_app"] = True
    if purchases.get("all_access") or any(purchases.get(product_id) for product_id in LEGACY_ALL_ACCESS_PRODUCTS):
        entitlements["all_access"] = True
    return entitlements


def get_user_purchases(user_id):
    user_id = safe_user_id(user_id)
    if is_database_user(user_id):
        return normalized_entitlements(storage.get_purchases(user_id))
    data = load_purchase_store()
    purchases = data["users"].setdefault(user_id, {})
    return normalized_entitlements(purchases)


def unlock_purchase(user_id, product_id, source="manual", session_id=None):
    user_id = safe_user_id(user_id)
    if product_id not in VALID_PRODUCTS:
        raise ValueError("Unknown product")
    if is_database_user(user_id):
        storage.unlock_purchase(user_id, product_id, source, session_id)
        return get_user_purchases(user_id)
    data = load_purchase_store()
    purchases = data["users"].setdefault(user_id, {})
    purchases[product_id] = True
    if session_id:
        data["stripe_sessions"][session_id] = {
            "user_id": user_id,
            "product_id": product_id,
            "source": source,
            "unlocked_at": datetime.now(timezone.utc).isoformat()
        }
    write_json(PURCHASES_FILE, data)
    return normalized_entitlements(purchases)


def stripe_configured():
    return bool(os.environ.get("STRIPE_SECRET_KEY"))


def stripe_ready_for(product):
    return bool(stripe_configured() and product and os.environ.get(product["price_env"]))


def product_lookup(product_id):
    if product_id == CORE_PRODUCT["id"]:
        return CORE_PRODUCT
    return next((item for item in ADD_ONS if item["id"] == product_id), None)


def public_product(item):
    payload = {k: item[k] for k in item if k not in {"amount_pence", "price_env"}}
    payload["checkout_ready"] = stripe_ready_for(item)
    return payload


def product_payload(user_id="demo"):
    purchases = get_user_purchases(user_id)
    products = [CORE_PRODUCT] + ADD_ONS
    payments_live = all(stripe_ready_for(item) for item in products)
    return {
        "core": public_product(CORE_PRODUCT),
        "addons": [public_product(item) for item in ADD_ONS],
        "purchases": purchases,
        "payment_provider": "stripe" if payments_live else "preview",
        "payments_live": payments_live,
        # Backward-compatible name for the current client. It now means fully checkout-ready.
        "stripe_configured": payments_live,
    }


def is_mode_unlocked(mode, user_id="demo"):
    product_id = MODE_REQUIREMENTS.get(mode)
    if not product_id:
        return True
    purchases = get_user_purchases(user_id)
    return bool(purchases.get(product_id))


def locked_response(mode):
    product_id = MODE_REQUIREMENTS.get(mode)
    item = ALL_ACCESS_PRODUCT
    name = item["name"]
    price = item["price"]
    content = f"# All Access required\n\n{name} unlocks this output style and every advanced feature. One-time price: {price} or equivalent local store tier. Core access is required first."
    return {
        "locked": True,
        "product_id": product_id,
        "content": content,
        "sections": {
            "next_steps": content,
            "provider_message": "",
            "things_to_check": "",
            "approval_checklist": "",
        },
    }


def json_response(handler, payload, status=200, headers=None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    response_headers = dict(headers or {})
    if getattr(handler, "_guest_cookie", None) and "Set-Cookie" not in response_headers:
        response_headers["Set-Cookie"] = handler._guest_cookie
    for name, value in response_headers.items():
        handler.send_header(name, value)
    handler.end_headers()
    handler.wfile.write(body)


def parse_json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except (TypeError, ValueError):
        length = 0
    if length > 1_000_000:
        raise ValueError("Request body is too large")
    raw = handler.rfile.read(length) if length else b"{}"
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


def session_cookie(handler, token, max_age=30 * 86400, name="adminpilot_session"):
    secure = handler.headers.get("X-Forwarded-Proto", "http") == "https"
    parts = [f"{name}={token}", "Path=/", f"Max-Age={max_age}", "HttpOnly", "SameSite=Lax"]
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def auth_payload(user=None):
    return {
        "authenticated": bool(user),
        "user": user,
        "account_storage_available": storage.available(),
    }


def read_raw_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except (TypeError, ValueError):
        length = 0
    if length > 1_000_000:
        raise ValueError("Request body is too large")
    return handler.rfile.read(length) if length else b""


def get_base_url(handler):
    configured = os.environ.get("APP_BASE_URL")
    if configured:
        return configured.rstrip("/")
    if os.environ.get("APP_ENV", "development").lower() == "production":
        raise RuntimeError("Public app URL is not configured")
    proto = handler.headers.get("X-Forwarded-Proto", "http")
    host = handler.headers.get("Host", f"localhost:{os.environ.get('PORT', '8000')}")
    return f"{proto}://{host}".rstrip("/")


def stripe_api_request(method, path, fields=None):
    secret = os.environ.get("STRIPE_SECRET_KEY")
    if not secret:
        raise RuntimeError("STRIPE_SECRET_KEY is not set")
    url = "https://api.stripe.com" + path
    data = None
    headers = {"Authorization": f"Bearer {secret}"}
    if fields is not None:
        data = urlencode(fields).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"Stripe API error {exc.code}: {detail}") from exc


def create_checkout_session(handler, body):
    if not stripe_configured():
        return json_response(handler, {"error": "Stripe is not configured. Set STRIPE_SECRET_KEY and product Price IDs."}, 400)
    product_id = body.get("product_id")
    product = product_lookup(product_id)
    if not product:
        return json_response(handler, {"error": "Unknown product"}, 400)
    price_id = os.environ.get(product["price_env"])
    if not price_id:
        return json_response(handler, {"error": "Checkout is not fully configured for this product."}, 400)
    user_id = effective_user_id(handler, body.get("user_id"))
    if product_id == "all_access" and not get_user_purchases(user_id).get("core_app"):
        return json_response(handler, {"error": "Purchase LifeAdmin AI Core before All Access."}, 409)
    email = str(body.get("email") or "").strip()
    base_url = get_base_url(handler)
    fields = {
        "mode": "payment",
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "success_url": f"{base_url}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{base_url}/?checkout=cancelled",
        "client_reference_id": user_id,
        "metadata[product_id]": product_id,
        "metadata[user_id]": user_id,
        "allow_promotion_codes": "true",
    }
    if env_bool("STRIPE_TERMS_REQUIRED", False):
        fields["consent_collection[terms_of_service]"] = "required"
    if env_bool("STRIPE_AUTOMATIC_TAX", False):
        fields["automatic_tax[enabled]"] = "true"
    if "@" in email and len(email) <= 200:
        fields["customer_email"] = email
    session = stripe_api_request("POST", "/v1/checkout/sessions", fields)
    return json_response(handler, {"url": session.get("url"), "id": session.get("id")})


def stripe_retrieve_session(session_id):
    safe_session = str(session_id or "").strip()
    if not safe_session.startswith("cs_"):
        raise RuntimeError("Invalid Stripe Checkout Session ID")
    return stripe_api_request("GET", "/v1/checkout/sessions/" + safe_session, None)


def checkout_status(handler, query):
    if not stripe_configured():
        return json_response(handler, {"error": "Stripe is not configured"}, 400)
    session_id = (query.get("session_id") or [""])[0]
    session = stripe_retrieve_session(session_id)
    metadata = session.get("metadata") or {}
    product_id = metadata.get("product_id")
    user_id = metadata.get("user_id") or effective_user_id(handler)
    current = current_user(handler)
    browser_user_id = current["id"] if current else guest_session(handler)
    if user_id != browser_user_id:
        return json_response(handler, {"error": "Checkout session does not belong to this browser or account"}, 403)
    paid = session.get("payment_status") == "paid"
    if paid and product_id in VALID_PRODUCTS:
        purchases = unlock_purchase(user_id, product_id, "stripe_status", session_id)
        return json_response(handler, {"paid": True, "product_id": product_id, "purchases": purchases})
    return json_response(handler, {"paid": False, "status": session.get("status"), "payment_status": session.get("payment_status")})


def parse_stripe_signature(header):
    pieces = {}
    for part in str(header or "").split(","):
        if "=" in part:
            key, value = part.split("=", 1)
            pieces.setdefault(key, []).append(value)
    timestamp = pieces.get("t", [None])[0]
    signatures = pieces.get("v1", [])
    return timestamp, signatures


def verify_stripe_webhook(payload, signature_header):
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not set")
    timestamp, signatures = parse_stripe_signature(signature_header)
    if not timestamp or not signatures:
        raise RuntimeError("Missing Stripe signature fields")
    try:
        timestamp_int = int(timestamp)
    except ValueError as exc:
        raise RuntimeError("Invalid Stripe signature timestamp") from exc
    tolerance = int(os.environ.get("STRIPE_WEBHOOK_TOLERANCE", "300"))
    if abs(int(time.time()) - timestamp_int) > tolerance:
        raise RuntimeError("Stripe webhook timestamp outside tolerance")
    signed_payload = f"{timestamp}.".encode("utf-8") + payload
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, sig) for sig in signatures):
        raise RuntimeError("Invalid Stripe webhook signature")


def handle_stripe_webhook(handler):
    try:
        payload = read_raw_body(handler)
        verify_stripe_webhook(payload, handler.headers.get("Stripe-Signature"))
        event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        return json_response(handler, {"error": str(exc)}, 400)
    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}
    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        metadata = obj.get("metadata") or {}
        product_id = metadata.get("product_id")
        user_id = metadata.get("user_id") or obj.get("client_reference_id") or "demo"
        session_id = obj.get("id")
        paid = event_type == "checkout.session.async_payment_succeeded" or obj.get("payment_status") == "paid"
        if paid and product_id in VALID_PRODUCTS:
            unlock_purchase(user_id, product_id, "stripe_webhook", session_id)
    return json_response(handler, {"received": True})


def demo_purchase(handler, body):
    if os.environ.get("APP_ENV", "development").lower() == "production":
        return json_response(handler, {"error": "Test purchases are disabled in production"}, 403)
    if not env_bool("DEMO_PAYMENTS", False):
        return json_response(handler, {"error": "Demo payments disabled"}, 403)
    product_id = body.get("product_id")
    if product_id not in VALID_PRODUCTS:
        return json_response(handler, {"error": "Unknown product"}, 400)
    user_id = effective_user_id(handler, body.get("user_id"))
    if product_id == "all_access" and not get_user_purchases(user_id).get("core_app"):
        return json_response(handler, {"error": "Demo-unlock Core before All Access."}, 409)
    unlock_purchase(user_id, product_id, "demo")
    return json_response(handler, product_payload(user_id))


def detect_playbook(task):
    canonical = domain.normalise_task(task)
    canonical_category = canonical.get("category_id")
    canonical_route = {
        "tv_broadband_mobile": "communications", "energy_water": "utilities", "council_tax_licences": "council_tax",
        "insurance": "insurance", "subscriptions_memberships": "streaming", "rent_mortgage_property": "housing_payment",
        "credit_loans_finance": "credit_payment", "home_security_maintenance": "bill", "transport_vehicle": "bill",
        "health_care_pets": "bill", "family_childcare_education": "bill", "other_regular_payment": "bill",
        "communications": "communications", "utilities": "utilities", "council_tax": "council_tax",
        "subscriptions": "streaming", "housing": "housing_payment", "credit": "credit_payment", "other_payment": "bill",
    }.get(canonical_category)
    if canonical_route:
        # A canonical category is authoritative; free-text heuristics only refine legacy tasks.
        if canonical.get("goal_id") == "identify_payment" or domain.is_unknown_payment(task):
            return "bill"
        if canonical_route in {"communications", "utilities", "council_tax", "insurance", "streaming", "housing_payment", "credit_payment", "travel"}:
            return canonical_route
    raw_text = " ".join(str(task.get(key, "")) for key in ("title", "notes"))
    text = re.sub(r"[^a-z0-9+]+", " ", raw_text.lower()).strip()
    category = str(task.get("category", "")).lower()

    def has(*phrases):
        padded = f" {text} "
        return any(f" {phrase} " in padded for phrase in phrases)

    signals = {
        "streaming": ("subscription", "subscriptions", "streaming", "netflix", "disney", "disney+",
                      "prime video", "prime video channels", "amazon channels", "paramount", "paramount+",
                      "discovery", "discovery+", "youtube premium", "spotify", "apple subscriptions",
                      "google play subscriptions", "gym membership", "software subscription",
                      "membership", "cancel subscription"),
        "insurance": ("insurance", "car insurance", "home insurance", "pet insurance",
                      "travel insurance", "contents insurance", "policy renewal", "premium",
                      "insurer", "no claims"),
        "communications": ("sky tv", "sky broadband", "virgin media", "broadband",
                           "mobile phone", "mobile contract", "phone bill", "landline",
                           "tv package", "telecom"),
        "utilities": ("gas bill", "electricity", "electric bill", "water bill", "energy",
                      "utility", "dual fuel", "meter reading"),
        "council_tax": ("council tax", "property band", "single person discount"),
        "housing_payment": ("mortgage", "rent payment", "monthly rent", "service charge",
                            "ground rent", "landlord payment"),
        "credit_payment": ("credit card", "minimum payment", "loan payment", "loan repayment",
                           "debt payment"),
        "refund": ("refund", "complaint", "returned", "faulty", "not received", "chargeback"),
        "travel": ("travel", "flight", "hotel", "booking reference", "passport", "trip"),
        "document": ("document", "form", "application", "letter", "evidence", "submission"),
        "bill": ("bill", "supplier", "tariff", "switching", "monthly payment",
                 "direct debit", "recurring card payment", "boiler cover", "appliance cover",
                 "breakdown cover", "tv licence"),
    }
    scores = {name: sum(1 for phrase in phrases if has(phrase)) for name, phrases in signals.items()}
    if re.search(r"\bNOW\b", raw_text):
        scores["streaming"] += 1
    category_map = {
        "bill check": "bill", "email draft": "refund", "travel admin": "travel",
        "document task": "document", "insurance": "insurance",
        "tv, broadband or phone": "communications",
        "gas, electricity or water": "utilities", "council tax": "council_tax",
        "subscriptions and memberships": "streaming",
        "other household bill or renewal": "bill",
    }
    if category in category_map:
        scores[category_map[category]] += 1
    specific_scores = {name: score for name, score in scores.items() if name != "bill"}
    best_specific = max(specific_scores, key=specific_scores.get)
    if specific_scores[best_specific]:
        return best_specific
    if scores["bill"]:
        return "bill"
    return "general"


def note_value(task, *labels):
    notes = str(task.get("notes", ""))
    wanted = {label.lower() for label in labels}
    for line in notes.splitlines():
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        if label.strip().lower() in wanted and value.strip():
            return value.strip()
    return ""


def named_subscription_sections(task):
    canonical = domain.normalise_task(task)
    details = canonical.get("details") or {}
    provider = str(details.get("provider") or note_value(task, "Provider", "Provider or membership") or "").strip()
    if not provider:
        return None
    billed_through = str(details.get("billing_route") or note_value(task, "Billed through") or "").strip()
    payment = str(details.get("amount") or note_value(task, "Current payment", "Current monthly or annual payment") or "").strip()
    renewal = str(details.get("next_payment_date") or details.get("date") or note_value(task, "Next payment", "Next payment or renewal date") or "").strip()
    goal_id = canonical.get("goal_id") or "check_bill"
    provider_label = provider
    known = provider_label.lower()
    wants_cancellation = goal_id == "cancel_switch"
    cancellation_route = {
        "netflix": "Open Netflix > Account > Cancel Membership. Confirm the final access date and save the cancellation confirmation.",
        "disney+": "Open Disney+ > Account > Subscription, then review the billing route and cancellation date before confirming.",
        "disney plus": "Open Disney+ > Account > Subscription, then review the billing route and cancellation date before confirming.",
        "now": "Open NOW > My Account > Manage account, then check each active membership and any Boost or minimum-term offer.",
        "spotify": "Open Spotify > Account > Your plan. If the plan is billed by a partner, use the billing partner's cancellation route.",
    }.get(known, f"Open the official {provider_label} account or billing page and confirm the cancellation route before acting.")
    supplied = [
        f"- Provider: {provider_label}.",
        f"- Current payment: {payment}." if payment else "- Confirm the current price and billing frequency.",
        f"- Next payment or renewal: {renewal}." if renewal else "- Confirm the next payment or renewal date.",
    ]
    if billed_through:
        supplied.append(f"- Billing route supplied: {billed_through}.")
    common = [(f"{provider_label} plan and billing", supplied)]
    if wants_cancellation:
        action_sections = [
            (f"{provider_label} cancellation steps", [
                f"1. {cancellation_route}",
                "2. Check whether cancellation takes effect immediately or at the end of the paid period.",
                "3. Save the confirmation and check the next statement for any unexpected charge.",
            ]),
        ]
        provider_draft = (
            "Provider cancellation draft",
            [f"Hello, please confirm the cancellation terms for my {provider_label} subscription, including the next billing date, final access date and whether any further payment is due. Please also confirm in writing when cancellation is complete."],
        )
    elif goal_id == "challenge_charge":
        action_sections = [
            (f"{provider_label} charge review", [
                "1. Confirm the charge date, amount and billing route before disputing it.",
                f"2. Check the official {provider_label} account for a plan change, renewal or add-on that explains the charge.",
                "3. If the charge still looks wrong, ask the provider to explain it and request a correction or refund where appropriate.",
            ]),
        ]
        provider_draft = (
            "Provider billing review draft",
            [f"Hello, I am querying a charge on my {provider_label} subscription. Please confirm what the charge relates to, the billing period and plan involved, and whether any correction or refund is due. Please reply in writing."],
        )
    else:
        action_sections = [
            (f"{provider_label} review steps", [
                f"1. Open the official {provider_label} account or billing page.",
                "2. Confirm the plan, billing frequency, next payment and any upcoming price change.",
                "3. Compare those details with the latest statement before deciding whether to make a change.",
            ]),
        ]
        provider_draft = (
            "Provider billing review draft",
            [f"Hello, please confirm the current plan, billing frequency, next payment date and any upcoming price change for my {provider_label} subscription. Please reply in writing."],
        )
    return common + action_sections + [
        ("Conditional billing-route checks", [
            f"- Use Apple Subscriptions only if the {provider_label} charge is billed by Apple.",
            f"- Use Google Play Subscriptions only if the {provider_label} charge is billed by Google Play.",
            f"- Check Amazon Channels only if the {provider_label} subscription appears in Prime Video Channels.",
            "- If the provider says billing is managed by a partner, confirm that partner before cancelling anywhere else.",
        ]),
        provider_draft,
        ("Confirmation checklist", [
            "- Correct provider account and profile checked.",
            "- Billing route and next payment date confirmed.",
            "- Any cancellation or dispute confirmation saved.",
            "- Final access date or correction outcome noted and next statement checked.",
            "- No cancellation or dispute submitted without human approval.",
        ]),
    ]


def playbook_sections(playbook, task=None):
    canonical = domain.normalise_task(task or {}) if task else {}
    goal_id = canonical.get("goal_id")
    details = canonical.get("details") or {}
    provider = str(details.get("provider") or "the provider").strip()

    if playbook == "streaming" and task:
        tailored = named_subscription_sections(task)
        if tailored:
            return tailored

    if playbook == "credit_payment" and task and goal_id == "challenge_charge":
        amount = details.get("amount") or "the charge"
        date = details.get("date") or "the statement date"
        return [
            ("Transaction check", [
                f"- Verify {amount} on {date} and confirm whether it is pending or fully posted.",
                "- Check the merchant name, any related subscription or household purchase, and whether the amount matches a receipt.",
                "- Keep screenshots or statements showing the disputed transaction, but do not copy full card numbers into the plan.",
            ]),
            ("Safest dispute route", [
                "1. If you recognise the merchant but the amount or service is wrong, contact the merchant first and keep the response.",
                "2. If the transaction is unauthorised or remains unresolved, use the official bank/card-provider dispute or fraud route.",
                "3. Continue making any undisputed minimum payments while the transaction is reviewed unless the lender tells you otherwise.",
            ]),
            ("Lender contact draft", [
                f"Hello, I am querying a transaction for {amount} shown on {date}. Please confirm the merchant information available, whether the transaction is pending or posted, and the correct dispute route if it is not recognised or is incorrect. Please reply in writing where possible.",
            ]),
            ("Payment-risk warning", [
                "- Do not send full card numbers, passwords or one-time security codes in a message.",
                "- Do not stop unrelated minimum payments solely because one transaction is disputed.",
                "- If you suspect fraud, use the card provider's official fraud channel promptly.",
            ]),
            ("Approval checklist", [
                "- Transaction amount, date and merchant wording checked.",
                "- Evidence saved safely.",
                "- Correct merchant/bank route selected.",
                "- Any dispute or card action approved by you before submission.",
            ]),
        ]

    if playbook == "communications" and task and goal_id == "challenge_charge":
        return [
            ("Bill increase check", [
                "- Compare the previous and current bills line by line.",
                "- Separate package price, handset/equipment finance, add-ons, roaming, out-of-bundle use and one-off charges.",
                "- Check the contract, discount end date and any provider notice explaining the increase.",
            ]),
            ("Provider contact draft", [
                f"Hello, I am querying an increase or unexpected charge on my {provider} bill. Please provide a breakdown showing what changed, when I was notified, and whether any correction, credit or cheaper suitable plan is available. Please reply in writing.",
            ]),
            ("Things to check", [
                "- Minimum term and contract end date.",
                "- Expired discounts or annual price changes.",
                "- Handset/equipment payments and add-ons.",
                "- Roaming or out-of-bundle usage.",
            ]),
            ("Approval checklist", [
                "- Old and new bills compared.",
                "- Provider explanation checked.",
                "- Refund/credit amount verified if offered.",
                "- No new contract accepted until price, term and exit fees are clear.",
            ]),
        ]

    if playbook == "council_tax" and task and goal_id == "challenge_charge":
        return [
            ("Council tax query check", [
                "- Confirm the council, property band, billing period and household details shown on the bill.",
                "- Check which discount, exemption or reduction you believe is missing or incorrect.",
                "- Use the council's official eligibility guidance and note any evidence it asks for.",
            ]),
            ("Council contact draft", [
                "Hello, please review my council tax bill and confirm the property band, billing period and discounts or reductions currently applied. Please explain whether the household details supplied indicate that another discount or correction should be considered, and what evidence is required. Please reply in writing.",
            ]),
            ("Things to check", [
                "- Do not assume entitlement until the council confirms it.",
                "- Check move dates and liable residents if the bill covers part of a year.",
                "- Keep copies of evidence submitted and the council's response.",
            ]),
            ("Approval checklist", [
                "- Bill period and property details verified.",
                "- Official eligibility criteria checked.",
                "- Evidence reviewed before submission.",
                "- Any declaration approved by you before sending.",
            ]),
        ]
    sections = {
        "streaming": [
            ("Subscription checklist", [
                "- Netflix: check plan, monthly price, next billing date, profiles using it and cancellation route.",
                "- Disney+: check plan, bundle status, next billing date and annual renewal.",
                "- NOW: check active memberships, Boost and any minimum-term offer.",
                "- Prime Video Channels: open Prime Video > Account & Settings > Channels and check each add-on.",
                "- Check Spotify and other music memberships for family-plan duplication and billing dates.",
                "- Review Apple subscriptions and Google Play subscriptions under every household account used for purchases.",
                "- Include gym membership, software subscriptions and other monthly or annual memberships.",
                "- Also check Paramount+, discovery+ and YouTube Premium for direct or third-party billing."
            ]),
            ("App Store subscription check", [
                "1. On iPhone/iPad open Settings > your name > Subscriptions.",
                "2. Record active and recently expired subscriptions, price and renewal date.",
                "3. Do not cancel an annual plan until you confirm whether access continues to its paid-through date."
            ]),
            ("Google Play subscription check", [
                "1. Open Google Play > profile picture > Payments & subscriptions > Subscriptions.",
                "2. Check every Google account used by the household.",
                "3. Record price, renewal date and cancellation terms before changing anything."
            ]),
            ("Amazon Prime Video Channels check", [
                "1. Check Prime Video Channels separately from the main Amazon Prime membership.",
                "2. Review channel renewals, free trials and subscriptions billed directly by the provider.",
                "3. Save cancellation confirmation for every channel removed."
            ]),
            ("Email search terms", [
                '- Search: "subscription", "renewal", "free trial", "price change", "payment receipt" and "membership".',
                '- Search provider names: "Netflix", "Disney+", "NOW", "Prime Video", "Paramount+", "discovery+" and "YouTube Premium".',
                '- Search card statements too; email alone may miss App Store, Google Play or Amazon billing.'
            ]),
            ("Renewal date table", [
                "| Service | Billed through | Price | Renewal date | Used recently? | Decision |",
                "|---|---|---:|---|---|---|",
                "| Netflix | Direct / App Store / Google Play | £___ | ___ | Yes / No | Keep / Cancel |",
                "| Disney+ | Direct / third party | £___ | ___ | Yes / No | Keep / Cancel |",
                "| NOW | Direct | £___ | ___ | Yes / No | Keep / Cancel |",
                "| Prime Video Channels | Amazon | £___ | ___ | Yes / No | Keep / Cancel |"
            ]),
            ("Cancellation priority order", [
                "1. Free trials renewing soonest.",
                "2. Duplicates and services nobody has used in the last 30 days.",
                "3. Monthly add-on channels, including Prime Video Channels.",
                "4. Price increases and overlapping content libraries.",
                "5. Annual plans only after checking the paid-through date and refund terms."
            ]),
            ("Refund eligibility check", [
                "- Check whether the charge is within a cooling-off period and whether streaming has already started.",
                "- Check provider, App Store, Google Play or Amazon refund rules based on who took payment.",
                "- Record the charge date, amount, usage after renewal and reason for the request.",
                "- Ask for a refund; do not state that one is guaranteed. Escalate an unauthorised charge through the payment provider."
            ]),
            ("Confirmation checklist", [
                "- Renewal dates and billing routes recorded before cancellation.",
                "- Correct household account and profile checked.",
                "- Cancellation screen completed and confirmation email saved.",
                "- Access end date noted and reminders removed.",
                "- Next statement checked for unexpected charges.",
                "- No cancellation submitted without human approval."
            ])
        ],
        "insurance": [
            ("Current policy details needed", ["- Identify whether this is car insurance, home insurance, pet insurance, travel insurance, contents insurance or another policy.", "- Record insurer, policy number, cover level, excess, named drivers/items, add-ons, current premium and renewal quote."]),
            ("Renewal date check", ["- Confirm renewal date, auto-renewal setting, notice period and the last safe day to switch."]),
            ("Comparison steps", ["1. Compare like-for-like cover and excess.", "2. Check exclusions and total annual cost.", "3. Verify insurer details and save quote references."]),
            ("Negotiation script", ["Hello, my renewal quote is £___. I have comparable cover quoted at £___. Please review the price and confirm your best like-for-like renewal offer in writing."]),
            ("Cancellation warning", ["- Do not cancel existing cover until replacement cover is confirmed to start without a gap.", "- Check fees, finance balances and no-claims evidence."]),
            ("Approval checklist", ["- Cover and exclusions compared.", "- Start date confirmed.", "- Final price approved.", "- Cancellation only sent after replacement is secured."])
        ],
        "refund": [
            ("Evidence checklist", ["- Receipt/order number, payment date, delivery/return proof, photos, prior messages and promised resolution."]),
            ("Consumer rights structure", ["1. State what was bought and when.", "2. Explain the problem factually.", "3. State the requested remedy and reasonable deadline.", "4. Keep rights wording general and verify current official guidance."]),
            ("Draft complaint message", ["Subject: Formal complaint and refund request", "", "Hello, I am writing about order/reference ___. The issue is ___. I have attached ___. Please confirm a refund of £___ by ___, or explain your proposed resolution in writing."]),
            ("Escalation route", ["1. Supplier complaints team.", "2. Relevant ombudsman, trade body or marketplace process.", "3. Card provider dispute route where eligible.", "4. Official consumer advice before legal action."]),
            ("Refund deadline tracker", ["| Event | Date | Response due | Status |", "|---|---|---|---|", "| Purchase/return | ___ | ___ | ___ |", "| Complaint sent | ___ | ___ | ___ |"]),
            ("Approval checklist", ["- Facts and amount checked.", "- Evidence attached safely.", "- Deadline is reasonable.", "- Message approved before sending."])
        ],
        "travel": [
            ("Booking reference checklist", ["- Flights, accommodation, transfers, parking, activities, insurance and provider contacts."]),
            ("Travel date timeline", ["- Now: verify names and dates.", "- Before change deadlines: amend or cancel if needed.", "- 7 days before: documents and check-in.", "- 24 hours before: status and final confirmations."]),
            ("Documents checklist", ["- Passport/ID validity, visas or entry rules, tickets, insurance, prescriptions and emergency contacts."]),
            ("Cancellation or amendment check", ["- Check fare type, deadlines, fees, credits, insurance cover and package protections before acting."]),
            ("Draft message to provider", ["Hello, please confirm the amendment or cancellation options for booking ___, including all fees, refund/credit amount and deadline. Please reply in writing."]),
            ("Approval checklist", ["- Names, dates and references verified.", "- Fees and replacement arrangements checked.", "- No booking changed without approval."])
        ],
        "document": [
            ("Document type", ["- Identify the exact form, letter, application or notice and the issuing organisation."]),
            ("Deadline", ["- Record the submission deadline, time zone, delivery method and consequence of delay."]),
            ("Evidence needed", ["- List required originals/copies, identity evidence, references, dates and supporting records."]),
            ("Response draft", ["Subject: Response regarding ___", "", "Please find my response and supporting information for reference ___. Please confirm receipt and advise if anything further is required."]),
            ("Submission checklist", ["- Fields complete.", "- Names and dates match evidence.", "- Attachments included.", "- Submission route verified.", "- Approval completed."]),
            ("Record keeping checklist", ["- Save final copy, attachments, receipt/reference, date sent and any reply."])
        ],
        "communications": [
            ("Services and bundle check", ["- List every service included: Sky TV or another TV package, Virgin Media, broadband, mobile phone, handset finance and landline.", "- Separate essential services from optional channels, boosts, data add-ons and equipment charges."]),
            ("Monthly payment check", ["- Record the normal monthly payment, recent price increases, one-off charges and discounts that expire.", "- Check whether TV, broadband and phone services have different contract-end dates."]),
            ("Contract and cancellation check", ["- Confirm minimum term, contract-end date, notice period, exit fee, equipment return and whether changing one service affects a bundle discount."]),
            ("Comparison checklist", ["- Compare like-for-like speed, data, calls, channels, equipment, setup fees and total contract cost.", "- Check service availability and installation dates before cancelling the current provider."]),
            ("Provider contact draft", ["Hello, please review my current package and confirm the monthly price, services included, contract-end date, exit fees and your best available like-for-like offer in writing."]),
            ("Approval checklist", ["- Package and equipment checked.", "- Total cost and contract length compared.", "- Service continuity confirmed.", "- No switch or cancellation submitted without approval."])
        ],
        "utilities": [
            ("Utility account check", ["- Identify gas, electricity, dual fuel or water and record the supplier, tariff, account reference and payment method.", "- Record meter type and readings where relevant."]),
            ("Payment and usage check", ["- Compare the monthly direct debit with actual annual usage, account credit/debit and recent statements.", "- Do not assume a lower monthly payment means a cheaper annual tariff."]),
            ("Tariff check", ["- Record unit rates, standing charges, tariff-end date, exit fees and any support or social tariff eligibility."]),
            ("Switching checklist", ["- Compare estimated annual cost using the same usage.", "- Confirm start date, final readings, credit balance handling and whether the switch is managed automatically."]),
            ("Supplier contact draft", ["Hello, please explain my current balance, annual usage estimate, tariff rates and monthly payment calculation. Please also confirm available tariffs and any exit fee in writing."]),
            ("Approval checklist", ["- Readings and usage checked.", "- Annual rather than monthly cost compared.", "- Dates and credit balance confirmed.", "- No tariff change approved without review."])
        ],
        "council_tax": [
            ("Council tax bill check", ["- Record the council, property address, property band, annual bill, instalment amount and billing period.", "- Check whether the bill covers a full year or a move-in/move-out period."]),
            ("Discount and support check", ["- Check single-person discount, student status, disability-related reductions, exemptions and local council-tax support only through the council's official guidance."]),
            ("Moving-home checklist", ["- Confirm move dates, old and new addresses, liable residents, final bill and any credit or balance transfer."]),
            ("Payment-plan check", ["- Confirm instalment dates, whether 10- or 12-month payments are available and the process for arrears or affordability support."]),
            ("Council contact draft", ["Hello, please review council tax account ___ and confirm the property band, billing period, balance, instalment plan and any discount or support information relevant to the details supplied."]),
            ("Approval checklist", ["- Council and billing period verified.", "- Household details checked.", "- Official eligibility guidance reviewed.", "- No declaration submitted without approval."])
        ],
        "housing_payment": [
            ("Housing payment details", ["- Identify mortgage, rent, service charges or ground rent and record the lender, landlord or managing agent.", "- Record the recurring payment, frequency, review date and current balance or statement period where relevant."]),
            ("Mortgage check", ["- Record interest rate, fixed-rate end date, remaining term, early repayment charge and current monthly payment before comparing options."]),
            ("Rent and service-charge check", ["- Record rent-review date, tenancy terms, service-charge period, budget or statement and the reason for any increase.", "- Keep notices and supporting documents."]),
            ("Affordability warning", ["- Contact the lender, landlord or qualified debt adviser early if a payment may be missed.", "- Do not stop or alter a payment solely on the basis of this general admin plan."]),
            ("Contact draft", ["Hello, please confirm the current payment, balance or statement period, the reason for any change, the next review date and the options available. Please reply in writing."]),
            ("Approval checklist", ["- Amount and date verified.", "- Contract or statement reviewed.", "- Consequences of changing payment checked.", "- Any regulated advice obtained where needed."])
        ],
        "credit_payment": [
            ("Recurring credit payment check", ["- Identify the credit card minimum payment, loan payment or other debt repayment, lender, due date, balance and interest rate.", "- Record whether payment is by direct debit or recurring card payment."]),
            ("Statement check", ["- Verify minimum payment, full statement balance, interest charged, fees and promotional-rate end date.", "- Check the lender's current statement rather than relying on an old monthly amount."]),
            ("Payment-risk warning", ["- Missing or reducing a payment can affect fees, interest and credit records.", "- Use official lender information or qualified debt advice before changing payments if affordability is a concern."]),
            ("Lender contact draft", ["Hello, please confirm my current balance, required payment, due date, interest rate, fees and any available support or payment-plan options in writing."]),
            ("Approval checklist", ["- Current statement checked.", "- Due date and required amount verified.", "- Consequences understood.", "- No payment instruction changed without approval."])
        ],
        "bill": [
            ("Household payment inventory", ["- Include TV licence, boiler cover, appliance cover, breakdown cover and other recurring direct debits or card payments.", "- If relevant, also check mortgage, rent, service charges, credit card minimum payments and loan payments."]),
            ("Current supplier", ["- Record supplier, lender, landlord or provider, account reference, tariff/plan and billing route."]),
            ("Current price", ["- Record monthly or recurring payment and actual annual cost; check recent increases and one-off charges."]),
            ("Contract end date", ["- Confirm minimum term, end date, notice period and exit fee."]),
            ("Cheaper alternative check", ["- Compare at least two like-for-like offers using current usage and total annual cost."]),
            ("Switching checklist", ["- Verify new supplier, price, term, start date, payment method and any credit balance process."]),
            ("Cancellation warning", ["- Avoid service gaps, double payment and exit fees; do not cancel a service the new supplier switches automatically."]),
            ("Approval checklist", ["- Comparison checked.", "- Savings are net of fees.", "- Start/end dates align.", "- Switch approved before submission."])
        ]
    }
    return sections.get(playbook, [])


def mode_sections(mode):
    sections = {
        "more_options": [
            ("Quick route", ["- Action: handle the nearest deadline, gather minimum evidence and prepare one safe next step.", "- Time: 10–15 minutes. Pro: fastest. Con: fewer comparisons. Best fit: urgent, low-value tasks."]),
            ("Balanced route", ["- Action: compare two alternatives, prepare a tailored draft and schedule one follow-up.", "- Time: 30–45 minutes. Pro: good evidence-to-effort ratio. Con: not exhaustive. Best fit: most household admin."]),
            ("Thorough route", ["- Action: build a complete record, compare all material options and verify current official terms.", "- Time: 60–90 minutes. Pro: strongest decision record. Con: highest effort. Best fit: costly, disputed or complex tasks."]),
            ("Option decision table", ["| Route | Time | Main benefit | Trade-off | Best fit |", "|---|---:|---|---|---|", "| Quick | 10–15 min | Speed | Limited comparison | Urgent/low value |", "| Balanced | 30–45 min | Practical confidence | Some options excluded | Normal admin |", "| Thorough | 60–90 min | Strongest evidence | More effort | High cost/dispute |"])
        ],
        "renewal_pro": [
            ("Renewal comparison questions", ["- Is cover/service like for like?", "- What is the total annual price including fees?", "- Are discounts temporary?", "- What changes at the next renewal?"]),
            ("Retention negotiation script", ["Hello, my renewal is £___, compared with £___ elsewhere for equivalent terms. Please remove avoidable add-ons and confirm your best total annual price, any new minimum term and the offer expiry in writing."]),
            ("Cancellation risk check", ["- Check notice period, exit fee, continuity, lost benefits and final payment before cancelling."]),
            ("Final decision grid", ["| Option | Annual cost | Key benefit | Key risk | Decision |", "|---|---:|---|---|---|", "| Renew | £___ | ___ | ___ | ___ |", "| Negotiate | £___ | ___ | ___ | ___ |", "| Switch | £___ | ___ | ___ | ___ |"])
        ],
        "refund_pro": [
            ("Subject line options", ["- Refund request for order ___", "- Formal complaint: unresolved order ___", "- Escalation: refund overdue since ___"]),
            ("First complaint email", ["Hello, order ___ was purchased on ___ and the problem is ___. I am requesting ___ by ___. Evidence attached: ___. Please confirm the outcome in writing."]),
            ("Follow-up email", ["Hello, I am following up on my message of ___. The requested response date has passed. Please confirm the refund status and payment date within 5 working days."]),
            ("Escalation wording", ["Please treat this as a formal escalation. Provide your final response, the relevant independent escalation route and the evidence used for your decision."])
        ],
        "document_pro": [
            ("Missing evidence audit", ["- Required identity: ___", "- Required dates/references: ___", "- Supporting originals or certified copies: ___", "- Missing item owner and deadline: ___"]),
            ("Official-source verification", ["- Record the issuing body's page title, URL, access date and current submission rules before sending."]),
            ("Final quality review", ["- Names and dates consistent.", "- Every mandatory field answered.", "- Attachments readable and correctly labelled.", "- Sensitive data limited to what is required."]),
            ("Submission receipt record", ["- Save final document, attachment list, submission timestamp, receipt/reference and follow-up date."])
        ],
        "travel_pro": [
            ("Booking control sheet", ["| Item | Reference | Provider | Deadline | Status |", "|---|---|---|---|---|", "| Flight | ___ | ___ | ___ | ___ |", "| Stay | ___ | ___ | ___ | ___ |", "| Transfer | ___ | ___ | ___ | ___ |"]),
            ("Insurance checks", ["- Destination and activities covered.", "- Medical declarations current.", "- Cancellation, baggage and excess understood.", "- Emergency number saved."]),
            ("Deadline plan", ["- Record provider amendment/cancellation deadlines separately from passport, visa, check-in and personal reminder dates."]),
            ("Day-before list", ["- Check live travel status, documents, check-in, baggage, transfers, payments, medicines and emergency contacts."])
        ],
        "family_board": [
            ("Weekly family admin board", ["| Task | Category | Owner | Priority | Due | Status |", "|---|---|---|---|---|---|", "| ___ | Bills/Renewals/School/Home/Travel | ___ | ___ | ___ | ___ |"]),
            ("Reminder rhythm", ["- Monday: assign owners.", "- Midweek: unblock overdue items.", "- Sunday: close completed tasks and plan the next week."]),
            ("Household approval rule", ["- The account holder reviews every payment, cancellation, booking or official submission before action."])
        ],
        "small_landlord": [
            ("Maintenance log", ["| Reported | Property/item | Issue | Priority | Contractor | Appointment | Closed |", "|---|---|---|---|---|---|---|", "| ___ | ___ | ___ | ___ | ___ | ___ | ___ |"]),
            ("Tenant update draft", ["Hello, thanks for reporting ___. It was logged on ___. The proposed next step is ___ on/around ___. Please confirm access arrangements."]),
            ("Document checklist", ["- Tenancy records, inventory, inspection notes, invoices, certificates and dated communications stored together."]),
            ("Compliance reminder", ["- Check current official local requirements or a qualified professional before acting. This plan is general admin support, not legal advice."])
        ]
    }
    return sections.get(mode, [])


def fallback_agent(task, mode="full"):
    if domain.is_unknown_payment(task):
        sections = domain.unknown_payment_sections(task)
        lines = [f"# Admin plan: {task.get('title', 'Unknown payment')}"]
        lines.extend([f"## Next steps\n{sections['next_steps']}", f"## Things to check\n{sections['things_to_check']}", f"## Approval checklist\n{sections['approval_checklist']}"])
        return "\n\n".join(lines)
    title = task.get("title", "Admin task")
    category = task.get("category", "General")
    notes = task.get("notes", "")
    due = task.get("due", "No due date set")
    priority = task.get("priority", "Medium")
    action = MODE_PROMPTS.get(mode, CATEGORY_PROMPTS.get(category, CATEGORY_PROMPTS["General"]))
    playbook = detect_playbook(task)
    lines = []
    lines.append(f"# Admin plan: {title}")
    lines.append("")
    lines.append(f"Priority: {priority}")
    lines.append(f"Due: {due}")
    lines.append(f"Task type: {category}")
    lines.append("")
    lines.append("## Output style")
    lines.append(action)
    lines.append("")
    if notes:
        lines.append("## Information supplied")
        lines.append(notes)
        lines.append("")
    if playbook != "general":
        lines.append(f"## Task-specific playbook: {playbook.title()}")
        lines.append("Use this checklist as a working plan. Confirm provider terms and approve every real-world action.")
        lines.append("")
        for heading, items in playbook_sections(playbook, task):
            lines.append(f"## {heading}")
            lines.extend(items)
            lines.append("")
        for heading, items in mode_sections(mode):
            lines.append(f"## {heading}")
            lines.extend(items)
            lines.append("")
        return "\n".join(lines).rstrip()
    lines.append("## Missing information")
    lines.append("- Account, supplier, reference number or booking reference.")
    lines.append("- Deadline, renewal date, payment date or travel date.")
    lines.append("- Current price, quote, refund amount or desired outcome.")
    lines.append("- Evidence such as screenshots, order emails, contract notes or letters.")
    lines.append("")
    lines.append("## Fastest safe route")
    lines.append("1. Confirm the account, supplier, deadline and desired outcome.")
    lines.append("2. Gather evidence such as contract dates, order numbers, prices, screenshots or letters.")
    lines.append("3. Compare the current position with at least two alternatives or official sources.")
    lines.append("4. Prepare a draft message or call script before contacting the provider.")
    lines.append("5. Review the final decision before sending, buying, cancelling or agreeing to terms.")
    lines.append("")
    lines.append("## Draft message")
    lines.append("Subject: Request for review")
    lines.append("")
    lines.append("Hello,")
    lines.append("")
    lines.append("Please review the matter below and confirm the available options, any deadline, and the best resolution available.")
    lines.append("")
    lines.append(f"Details: {notes if notes else title}")
    lines.append("")
    lines.append("Please reply in writing so I have a clear record.")
    lines.append("")
    lines.append("Kind regards")
    lines.append("")
    lines.append("## Risk flags")
    lines.append("- Contract exit fees or minimum terms.")
    lines.append("- Payment deadlines, cancellation windows or refund limits.")
    lines.append("- Missing evidence or unclear supplier wording.")
    lines.append("- Regulated matters that need official guidance.")
    lines.append("")
    lines.append("## Approval checklist")
    lines.append("- No payment or purchase made without approval.")
    lines.append("- No cancellation sent without checking contract terms.")
    lines.append("- No personal data shared unless required and trusted.")
    lines.append("- Important decisions checked against official sources.")
    return "\n".join(lines)


PROVIDER_MESSAGE_HEADINGS = {
    "negotiation script", "draft complaint message", "draft message to provider",
    "response draft", "provider contact draft", "supplier contact draft",
    "council contact draft", "contact draft", "lender contact draft",
    "first complaint email", "follow-up email", "escalation wording",
    "retention negotiation script", "tenant update draft", "draft message",
    "provider cancellation draft",
    "provider billing review draft", "provider message",
}

APPROVAL_HEADINGS = {
    "approval checklist", "confirmation checklist", "submission checklist",
    "household approval rule",
}

THINGS_TO_CHECK_HEADINGS = {
    "missing information", "risk flags", "cancellation warning",
    "contract and cancellation check", "cancellation or amendment check",
    "affordability warning", "payment-risk warning", "cancellation risk check",
    "insurance checks", "compliance reminder", "conditional billing-route checks",
    "refund eligibility check", "things to check",
}

OMITTED_RESULT_HEADINGS = {"output style", "information supplied"}


def structured_result(text):
    """Split generated markdown using exact, reviewed heading names only."""
    heading_re = re.compile(r"(?m)^(#{1,3})\s+(.+?)\s*$")
    matches = list(heading_re.finditer(text))
    buckets = {
        "next_steps": [],
        "provider_message": [],
        "things_to_check": [],
        "approval_checklist": [],
    }
    if not matches:
        buckets["next_steps"].append(text.strip())
    else:
        intro = text[:matches[0].start()].strip()
        if intro:
            buckets["next_steps"].append(intro)
        for index, match in enumerate(matches):
            heading = match.group(2).strip()
            normalized = heading.lower()
            body_start = match.end()
            body_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            body = text[body_start:body_end].strip()
            if normalized in OMITTED_RESULT_HEADINGS or normalized.startswith("task-specific playbook:"):
                continue
            content = f"## {heading}\n{body}".strip()
            if normalized in PROVIDER_MESSAGE_HEADINGS:
                bucket = "provider_message"
            elif normalized in APPROVAL_HEADINGS:
                bucket = "approval_checklist"
            elif normalized in THINGS_TO_CHECK_HEADINGS:
                bucket = "things_to_check"
            else:
                bucket = "next_steps"
            buckets[bucket].append(content)
    return {key: "\n\n".join(part for part in parts if part).strip() for key, parts in buckets.items()}


def safety_notice(task):
    """Add concise escalation guidance for higher-risk household-admin scenarios."""
    canonical = domain.normalise_task(task)
    category = canonical.get("category_id", "")
    text = json.dumps(canonical, ensure_ascii=False).lower()
    notices = []

    fraud_terms = ("fraud", "fraudulent", "unauthorised", "unauthorized", "stolen card", "scam")
    if any(term in text for term in fraud_terms):
        notices.append(
            "If you suspect fraud or an unauthorised payment, use the bank or card provider's official fraud channel promptly. "
            "Do not share passwords, PINs, one-time codes or full card details."
        )

    if category == "energy_water" and any(term in text for term in ("arrears", "debt", "disconnection", "disconnect", "cannot pay", "can't pay", "afford")):
        notices.append(
            "If you are struggling to pay or facing disconnection, contact the supplier through its official support route and seek qualified debt or energy-support guidance before stopping payments."
        )

    if category == "rent_mortgage_property" and any(term in text for term in ("eviction", "evict", "repossession", "repossess", "arrears", "notice to quit", "section 8", "section 21")):
        notices.append(
            "If eviction or repossession is a risk, contact the landlord or lender through an official route and obtain qualified housing or debt advice promptly. Do not rely on this plan as legal advice."
        )

    if category == "insurance" and any(term in text for term in ("emergency", "urgent claim", "accident", "flood", "fire", "theft")):
        notices.append(
            "For an urgent insurance incident, use the insurer's official claims or emergency route and follow any time-sensitive policy instructions."
        )

    return notices


def result_contract(text, task):
    """Return a stable, privacy-safe result envelope for fallback and live AI output."""
    sections = structured_result(text)
    if domain.is_unknown_payment(task):
        unknown = domain.unknown_payment_sections(task)
        unknown["known_details"] = domain.normalise_task(task).get("details") or {}
        unknown["missing_details"] = domain.missing_details(task)
        notices = safety_notice(task)
        if notices:
            extra = "\n".join(f"- {item}" for item in notices)
            unknown["things_to_check"] = (unknown.get("things_to_check", "").strip() + "\n\n## Safety check\n" + extra).strip()
        return unknown
    sections["provider_email"] = domain.provider_email_for_sections(sections, task)
    sections["known_details"] = {
        key: value for key, value in (domain.normalise_task(task).get("details") or {}).items()
        if value
    }
    sections["missing_details"] = domain.missing_details(task)
    notices = safety_notice(task)
    if notices:
        extra = "\n".join(f"- {item}" for item in notices)
        existing = sections.get("things_to_check", "").strip()
        sections["things_to_check"] = (existing + "\n\n## Safety check\n" + extra).strip() if existing else "## Safety check\n" + extra
    return sections


def call_openai(task, mode="full"):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return fallback_agent(task, mode), "fallback"
    model = os.environ.get("OPENAI_MODEL", "gpt-5-mini")
    user_prompt = {
        "mode": mode,
        "task": task,
        "mode_instruction": MODE_PROMPTS.get(mode, MODE_PROMPTS["full"]),
        "detected_playbook": detect_playbook(task),
        "playbook_requirements": playbook_sections(detect_playbook(task), task),
        "required_output": [
            "## Next steps",
            "## Provider message",
            "## Things to check",
            "## Approval checklist",
        ],
        "output_contract": (
            "Use exactly the four required H2 headings, in that order. "
            "Place provider-ready text only under Provider message and leave its body empty "
            "when no genuine provider message is useful."
        ),
    }
    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_prompt)}
        ]
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data.get("output_text")
            if not text:
                parts = []
                for item in data.get("output", []):
                    for content in item.get("content", []):
                        if content.get("type") in ("output_text", "text"):
                            parts.append(content.get("text", ""))
                text = "\n".join(p for p in parts if p).strip()
            return text or fallback_agent(task, mode), "openai"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, Exception) as exc:
        return fallback_agent(task, mode), "fallback"


_AUTH_RATE = {}


def auth_rate_limited(handler, action, limit=10):
    """Simple per-IP abuse guard for account endpoints."""
    now = time.time()
    ip = handler.client_address[0] if handler.client_address else "unknown"
    key = f"{ip}:{action}"
    recent = [stamp for stamp in _AUTH_RATE.get(key, []) if now - stamp < 60]
    if len(recent) >= limit:
        _AUTH_RATE[key] = recent
        return True
    recent.append(now)
    _AUTH_RATE[key] = recent
    return False


_AGENT_RATE = {}


def agent_rate_limited(handler):
    now = time.time()
    key = handler.client_address[0] if handler.client_address else "unknown"
    recent = [stamp for stamp in _AGENT_RATE.get(key, []) if now - stamp < 60]
    if len(recent) >= 12:
        _AGENT_RATE[key] = recent
        return True
    recent.append(now)
    _AGENT_RATE[key] = recent
    return False


def is_admin(user):
    if not user:
        return False
    allowed = {email.strip().lower() for email in os.environ.get("ADMIN_EMAILS", "").split(",") if email.strip()}
    return user.get("email", "").lower() in allowed


def admin_overview(user):
    if not is_admin(user):
        return None
    if storage.available():
        try:
            return storage.admin_overview()
        except Exception:
            # Fall back to aggregate guest/demo metrics without exposing a database error.
            pass
    store = read_json(TASKS_FILE, {})
    tasks = [task for values in (store.get("users", {}).values() if isinstance(store, dict) else []) for task in (values if isinstance(values, list) else [])]
    note_store = read_json(NOTES_FILE, {})
    notes = [note for values in (note_store.get("users", {}).values() if isinstance(note_store, dict) else []) for note in (values if isinstance(values, list) else [])]
    purchase_store = load_purchase_store()
    all_purchases = [item for values in purchase_store.get("users", {}).values() for item, enabled in values.items() if enabled]
    by_category, by_goal = {}, {}
    for task in tasks:
        category = task.get("category_id") or task.get("category") or "unknown"
        goal = task.get("goal_id") or "unspecified"
        by_category[category] = by_category.get(category, 0) + 1
        by_goal[goal] = by_goal.get(goal, 0) + 1
    return {
        "users": {"total": 0},
        "tasks": {"total": len(tasks), "open": sum(1 for x in tasks if x.get("status", "Open") != "Done"), "completed": sum(1 for x in tasks if x.get("status") == "Done")},
        "plans": {"total": len(notes), "fallback": sum(1 for x in notes if x.get("source") == "fallback"), "ai": sum(1 for x in notes if x.get("source") == "openai")},
        "purchases": {"entitlement_records": len(all_purchases), "core": all_purchases.count("core_app"), "all_access": all_purchases.count("all_access")},
        "categories": by_category,
        "goals": by_goal,
        "recent_activity": [
            {
                "type": "task",
                "category": x.get("category_id") or x.get("category") or "other_regular_payment",
                "time": x.get("created_at"),
            }
            for x in tasks[:20]
        ],
    }


class AdminPilotHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        directory = WEB_DIR if os.path.isdir(WEB_DIR) else APP_DIR
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format, *args):
        return

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        user = current_user(self)
        user_id = user["id"] if user else guest_session(self)
        if path == "/api/healthz":
            return json_response(self, {"status": "ok"})
        if path == "/":
            index_path = os.path.join(WEB_DIR, "index.html")
            if os.path.isfile(index_path):
                self.path = "/index.html"
                return super().do_GET()
            return json_response(self, {"error": "Web app has not been built yet. Run the frontend build first."}, 503)
        if path == "/api/tasks":
            tasks = storage.list_tasks(user_id) if user else anonymous_items(TASKS_FILE, user_id, DEFAULT_TASKS)
            return json_response(self, {"tasks": tasks, "storage": storage.backend() if user else "browser"})
        if path == "/api/settings":
            if not is_admin(user):
                return json_response(self, {"error": "Admin access required"}, 403)
            return json_response(self, read_json(SETTINGS_FILE, {}))
        if path == "/api/notes":
            notes = storage.list_notes(user_id) if user else anonymous_items(NOTES_FILE, user_id)
            return json_response(self, {"notes": notes})
        if path == "/api/auth/me":
            return json_response(self, auth_payload(user))
        if path == "/api/products":
            return json_response(self, product_payload(user_id))
        if path == "/api/catalog":
            return json_response(self, domain.catalog())
        if path == "/api/admin/overview":
            overview = admin_overview(user)
            return json_response(self, overview if overview is not None else {"error": "Admin access required"}, 200 if overview is not None else 403)
        if path == "/api/qa-report":
            return json_response(self, QA_REPORT)
        if path == "/api/checkout/status":
            try:
                return checkout_status(self, query)
            except Exception as exc:
                return json_response(self, {"error": str(exc)}, 400)
        if path.startswith("/api/"):
            return json_response(self, {"error": "Unknown endpoint"}, 404)
        requested = os.path.join(WEB_DIR, path.lstrip("/"))
        if os.path.isfile(requested):
            return super().do_GET()
        index_path = os.path.join(WEB_DIR, "index.html")
        if os.path.isfile(index_path):
            self.path = "/index.html"
            return super().do_GET()
        return json_response(self, {"error": "Web app has not been built yet."}, 503)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/stripe/webhook":
            return handle_stripe_webhook(self)
        try:
            body = parse_json_body(self)
        except ValueError as exc:
            return json_response(self, {"error": str(exc)}, 413)
        user = current_user(self)
        user_id = user["id"] if user else guest_session(self)
        if path == "/api/auth/register":
            if auth_rate_limited(self, "register", 6):
                return json_response(self, {"error": "Too many account attempts. Please wait and try again."}, 429, {"Retry-After": "60"})
            try:
                guest_id = None if user else guest_session(self)
                user = storage.create_user(body.get("email"), body.get("password"))
                if guest_id:
                    migrate_guest_workspace(guest_id, user["id"])
                token = storage.create_session(user["id"])
                return json_response(self, auth_payload(user), 201, {"Set-Cookie": session_cookie(self, token)})
            except (ValueError, storage.StorageUnavailable) as exc:
                return json_response(self, {"error": str(exc)}, 400)
        if path == "/api/auth/login":
            if auth_rate_limited(self, "login", 10):
                return json_response(self, {"error": "Too many sign-in attempts. Please wait and try again."}, 429, {"Retry-After": "60"})
            try:
                user = storage.authenticate(body.get("email"), body.get("password"))
                token = storage.create_session(user["id"])
                return json_response(self, auth_payload(user), headers={"Set-Cookie": session_cookie(self, token)})
            except (ValueError, storage.StorageUnavailable) as exc:
                return json_response(self, {"error": str(exc)}, 401)
        if path == "/api/auth/logout":
            storage.delete_session(session_token(self))
            return json_response(self, auth_payload(), headers={"Set-Cookie": session_cookie(self, "", 0)})
        if path == "/api/auth/delete":
            if not user:
                return json_response(self, {"error": "Sign in before deleting an account"}, 401)
            try:
                storage.delete_account(user["id"], body.get("password"))
                return json_response(self, {"deleted": True}, headers={"Set-Cookie": session_cookie(self, "", 0)})
            except ValueError as exc:
                return json_response(self, {"error": str(exc)}, 403)
        if path == "/api/checkout":
            try:
                return create_checkout_session(self, body)
            except Exception as exc:
                return json_response(self, {"error": str(exc)}, 400)
        if path == "/api/demo-purchase":
            return demo_purchase(self, body)
        if path == "/api/suggest":
            return json_response(self, domain.suggest(body.get("query", "")))
        if path == "/api/tasks":
            details = body.get("details") if isinstance(body.get("details"), dict) else {}
            task = {
                "id": str(uuid.uuid4()),
                "title": str(body.get("title") or "").strip()[:160],
                "category": "",
                "category_id": body.get("category_id") or body.get("category", "other_regular_payment"),
                "goal_id": body.get("goal_id", "check_bill"),
                "details": {str(k)[:80]: str(v)[:500] for k, v in details.items() if v not in (None, "")},
                "priority": body.get("priority", "Medium"),
                "due": body.get("due", ""),
                "status": "Open",
                "notes": body.get("notes", "").strip()[:4000],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            task = domain.normalise_task(task)
            if not task.get("title"):
                task["title"] = domain.auto_title(task["category_id"], task["goal_id"], task.get("details", {}).get("provider", ""))
            if user:
                storage.create_task(user_id, task)
            else:
                tasks = anonymous_items(TASKS_FILE, user_id, DEFAULT_TASKS)
                tasks.insert(0, task)
                save_anonymous_items(TASKS_FILE, user_id, tasks)
            return json_response(self, {"task": task}, 201)
        if path == "/api/tasks/update":
            task_id = body.get("id")
            changes = {key: body[key] for key in ["title", "category", "category_id", "goal_id", "details", "priority", "due", "status", "notes"] if key in body}
            if user:
                updated = storage.update_task(user_id, task_id, changes)
            else:
                tasks = anonymous_items(TASKS_FILE, user_id, DEFAULT_TASKS)
                updated = None
                for task in tasks:
                    if task.get("id") == task_id:
                        task.update(changes)
                        updated = task
                        break
                if updated:
                    save_anonymous_items(TASKS_FILE, user_id, tasks)
            if updated:
                return json_response(self, {"task": updated})
            return json_response(self, {"error": "Task not found"}, 404)
        if path == "/api/tasks/delete":
            task_id = body.get("id")
            if user:
                deleted = storage.delete_task(user_id, task_id)
            else:
                tasks = anonymous_items(TASKS_FILE, user_id, DEFAULT_TASKS)
                remaining = [task for task in tasks if task.get("id") != task_id]
                deleted = len(remaining) != len(tasks)
                if deleted:
                    save_anonymous_items(TASKS_FILE, user_id, remaining)
            if not deleted:
                return json_response(self, {"error": "Task not found"}, 404)
            return json_response(self, {"deleted": True, "id": task_id})
        if path == "/api/purchases":
            return demo_purchase(self, body)
        if path == "/api/agent":
            if agent_rate_limited(self):
                return json_response(self, {"error": "Please wait before generating another plan."}, 429, {"Retry-After": "60"})
            task = body.get("task", {})
            mode = body.get("mode", "full")
            if not is_mode_unlocked(mode, user_id):
                return json_response(self, {"note": locked_response(mode)})
            text, source = call_openai(task, mode)
            contract = result_contract(text, task)
            section_keys = {"next_steps", "provider_message", "things_to_check", "approval_checklist"}
            note = {
                "id": str(uuid.uuid4()),
                "task_id": task.get("id"),
                "title": task.get("title", "Admin plan"),
                "source": source,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "content": text,
                "sections": {key: contract.get(key, "") for key in section_keys},
                "provider_email": contract.get("provider_email"),
                "known_details": contract.get("known_details", {}),
                "missing_details": contract.get("missing_details", []),
            }
            if user:
                storage.add_note(user_id, note)
            else:
                notes = anonymous_items(NOTES_FILE, user_id)
                notes.insert(0, note)
                save_anonymous_items(NOTES_FILE, user_id, notes[:200])
            return json_response(self, {"note": note})
        if path == "/api/settings":
            if not is_admin(user):
                return json_response(self, {"error": "Admin access required"}, 403)
            current = read_json(SETTINGS_FILE, {})
            current.update(body)
            write_json(SETTINGS_FILE, current)
            return json_response(self, current)
        return json_response(self, {"error": "Unknown endpoint"}, 404)


def main():
    ensure_data()
    if os.environ.get("APP_ENV", "development").lower() == "production" and not os.environ.get("SESSION_SECRET"):
        raise RuntimeError("SESSION_SECRET must be set in production")
    if storage.available():
        try:
            storage.ensure_schema()
        except Exception as exc:
            print(f"Account storage unavailable during startup: {exc}")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), AdminPilotHandler)
    print(f"LifeAdmin AI running at http://localhost:{port}")
    if stripe_configured():
        print("Stripe Checkout enabled. Make sure product Price IDs and webhook secret are set.")
    else:
        print("Stripe Checkout not configured. Demo payments are used if DEMO_PAYMENTS=true.")
    server.serve_forever()


if __name__ == "__main__":
    main()
