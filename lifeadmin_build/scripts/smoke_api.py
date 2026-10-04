"""Live API smoke checks for the owner-review customer path."""

from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener
import json
import os
import uuid


BASE_URL = os.environ.get("LIFEADMIN_SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def new_client():
    return build_opener(HTTPCookieProcessor(CookieJar()))


def request_json(client, path, payload=None, expected_status=200):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="GET" if payload is None else "POST",
    )
    try:
        with client.open(request, timeout=10) as response:
            status = response.status
            body = json.load(response)
    except HTTPError as error:
        status = error.code
        body = json.load(error)
    assert status == expected_status, f"{path}: expected {expected_status}, got {status}: {body}"
    return body


def main():
    client = new_client()
    other_guest = new_client()

    health = request_json(client, "/api/health")
    assert health["status"] == "ok"

    catalog = request_json(client, "/api/catalog")
    assert len(catalog["categories"]) == 12
    assert len(catalog["goals"]) == 7

    auth = request_json(client, "/api/auth/me")
    assert auth["authenticated"] is False

    products = request_json(client, "/api/products")
    assert products["core"]["id"] == "core_app"
    assert products["core"]["price"] == "£0.99 / $0.99"
    assert [item["id"] for item in products["addons"]] == ["all_access"]
    assert products["addons"][0]["price"] == "£1.99 / $1.99"
    assert products["payments_live"] is False
    assert products["payment_provider"] == "preview"

    task_id = None
    note_id = None
    account_created = False
    account_deleted = False
    email = f"smoke-{uuid.uuid4().hex}@example.invalid"
    password = "Smoke-Test-Only-2026!"

    try:
        created = request_json(
            client,
            "/api/tasks",
            {
                "title": "CI energy renewal",
                "category_id": "energy_water",
                "goal_id": "prepare_renewal",
                "priority": "Medium",
                "details": {
                    "provider": "Smoke Energy",
                    "account_reference": "SMOKE-REF",
                    "utility_type": "Electricity",
                    "tariff": "Standard variable",
                    "renewal_date": "2026-11-01",
                },
                "notes": "",
            },
            expected_status=201,
        )
        task = created["task"]
        task_id = task["id"]
        assert task["category_id"] == "energy_water"
        assert task["goal_id"] == "prepare_renewal"
        assert task["details"]["provider"] == "Smoke Energy"
        assert task["details"]["account_reference"] == "SMOKE-REF"

        tasks = request_json(client, "/api/tasks")["tasks"]
        persisted_task = next(item for item in tasks if item["id"] == task_id)
        assert persisted_task["details"]["provider"] == "Smoke Energy"
        assert persisted_task["details"]["account_reference"] == "SMOKE-REF"

        generated = request_json(client, "/api/agent", {"task": persisted_task, "mode": "full"})
        note = generated["note"]
        note_id = note["id"]
        assert note["task_id"] == task_id
        assert {"next_steps", "provider_message", "things_to_check", "approval_checklist"} <= set(note["sections"])
        assert note["known_details"]["provider"] == "Smoke Energy"
        assert note["known_details"]["account_reference"] == "SMOKE-REF"
        assert any(item["id"] == note_id for item in request_json(client, "/api/notes")["notes"])

        assert request_json(other_guest, "/api/auth/me")["authenticated"] is False
        assert all(item["id"] != task_id for item in request_json(other_guest, "/api/tasks")["tasks"])
        assert all(item["id"] != note_id for item in request_json(other_guest, "/api/notes")["notes"])
        request_json(other_guest, "/api/tasks/delete", {"id": task_id}, expected_status=404)
        request_json(other_guest, "/api/notes/delete", {"id": note_id}, expected_status=404)
        assert any(item["id"] == task_id for item in request_json(client, "/api/tasks")["tasks"])
        assert any(item["id"] == note_id for item in request_json(client, "/api/notes")["notes"])

        registered = request_json(
            client,
            "/api/auth/register",
            {"email": email, "password": password},
            expected_status=201,
        )
        account_created = True
        assert registered["authenticated"] is True
        assert registered["user"]["email"] == email
        assert any(item["id"] == task_id for item in request_json(client, "/api/tasks")["tasks"])
        assert any(item["id"] == note_id for item in request_json(client, "/api/notes")["notes"])

        logged_out = request_json(client, "/api/auth/logout", {})
        assert logged_out["authenticated"] is False
        assert request_json(client, "/api/auth/me")["authenticated"] is False
        assert all(item["id"] != task_id for item in request_json(client, "/api/tasks")["tasks"])
        assert all(item["id"] != note_id for item in request_json(client, "/api/notes")["notes"])

        logged_in = request_json(client, "/api/auth/login", {"email": email, "password": password})
        assert logged_in["authenticated"] is True
        assert any(item["id"] == task_id for item in request_json(client, "/api/tasks")["tasks"])
        assert any(item["id"] == note_id for item in request_json(client, "/api/notes")["notes"])

        request_json(client, "/api/notes/delete", {"id": note_id})
        note_id = None
        assert all(item["id"] != note["id"] for item in request_json(client, "/api/notes")["notes"])

        request_json(client, "/api/tasks/delete", {"id": task_id})
        task_id = None
        assert all(item["id"] != task["id"] for item in request_json(client, "/api/tasks")["tasks"])

        deleted = request_json(client, "/api/auth/delete", {"password": password})
        assert deleted["deleted"] is True
        account_deleted = True
        assert request_json(client, "/api/auth/me")["authenticated"] is False
    finally:
        if account_created and not account_deleted:
            try:
                request_json(client, "/api/auth/login", {"email": email, "password": password})
                request_json(client, "/api/auth/delete", {"password": password})
                account_deleted = True
                task_id = None
                note_id = None
            except Exception:
                pass
        if note_id and not account_deleted:
            try:
                request_json(client, "/api/notes/delete", {"id": note_id})
            except Exception:
                pass
        if task_id and not account_deleted:
            try:
                request_json(client, "/api/tasks/delete", {"id": task_id})
            except Exception:
                pass


if __name__ == "__main__":
    main()
