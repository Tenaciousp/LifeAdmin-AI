import io
import json
import os
import unittest
from unittest.mock import patch

import app


class RouteHandler:
    def __init__(self, body):
        raw = json.dumps(body).encode("utf-8")
        self.path = "/api/ai/draft"
        self.headers = {"Content-Length": str(len(raw))}
        self.rfile = io.BytesIO(raw)
        self.wfile = io.BytesIO()
        self.client_address = ("synthetic-client", 1)
        self.status = None
        self._guest_cookie = None

    def send_response(self, status): self.status = status
    def send_header(self, name, value): pass
    def end_headers(self): pass
    def payload(self): return json.loads(self.wfile.getvalue().decode("utf-8"))


class GeminiDraftTests(unittest.TestCase):
    def route(self, body):
        handler = RouteHandler(body)
        app.AdminPilotHandler._do_POST(handler)
        return handler.status, handler.payload()

    def test_route_requires_enabled_service_and_explicit_consent(self):
        with patch.dict(os.environ, {"GEMINI_DRAFTS_ENABLED": "false"}, clear=False):
            with patch.object(app, "call_gemini_draft") as generate:
                status, _ = self.route({"prompt": "Synthetic", "output": "letter", "consent": True})
                self.assertEqual(status, 503)
                generate.assert_not_called()
        with patch.dict(os.environ, {"GEMINI_DRAFTS_ENABLED": "true", "GEMINI_API_KEY": "test-secret"}, clear=False):
            with patch.object(app, "call_gemini_draft") as generate:
                status, _ = self.route({"prompt": "Synthetic", "output": "letter", "consent": False})
                self.assertEqual(status, 400)
                generate.assert_not_called()

    def test_consented_generation_returns_reviewable_text_without_saving_it(self):
        body = {"prompt": "Only selected synthetic details", "output": "letter", "consent": True}
        expected = {"subject": "Synthetic subject", "body": "Synthetic draft body"}
        with patch.dict(os.environ, {"GEMINI_DRAFTS_ENABLED": "true", "GEMINI_API_KEY": "server-only-secret"}, clear=False), \
             patch.object(app, "call_gemini_draft", return_value=expected) as generate, \
             patch.object(app, "ai_draft_rate_limited", return_value=False):
            status, result = self.route(body)
        self.assertEqual(status, 200)
        self.assertEqual(result, expected)
        generate.assert_called_once_with(body["prompt"], body["output"])
        self.assertNotIn("server-only-secret", json.dumps(result))

    def test_invalid_and_rate_limited_requests_do_not_call_gemini(self):
        settings = {"GEMINI_DRAFTS_ENABLED": "true", "GEMINI_API_KEY": "test-secret"}
        with patch.dict(os.environ, settings, clear=False), patch.object(app, "call_gemini_draft") as generate:
            status, _ = self.route({"prompt": "x" * 20001, "output": "plan", "consent": True})
            self.assertEqual(status, 400)
            status, _ = self.route({"prompt": "synthetic", "output": {"bad": True}, "consent": True})
            self.assertEqual(status, 400)
            with patch.object(app, "ai_draft_rate_limited", return_value=True):
                status, _ = self.route({"prompt": "synthetic", "output": "plan", "consent": True})
            self.assertEqual(status, 429)
            generate.assert_not_called()

    def test_provider_request_keeps_key_server_side_and_returns_validated_json(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self):
                value = {"subject": "Example subject", "body": "Example body"}
                return json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(value)}]}}]}).encode()
        captured = {}
        def open_request(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return Response()
        with patch.dict(os.environ, {"GEMINI_DRAFTS_ENABLED": "true", "GEMINI_API_KEY": "server-secret"}, clear=False), \
             patch.object(app.urllib.request, "urlopen", side_effect=open_request):
            result = app.call_gemini_draft("Reviewed synthetic prompt", "letter")
        self.assertEqual(result, {"subject": "Example subject", "body": "Example body"})
        request = captured["request"]
        self.assertEqual(request.get_header("X-goog-api-key"), "server-secret")
        payload = json.loads(request.data)
        self.assertEqual(payload["contents"][0]["parts"][0]["text"], "Reviewed synthetic prompt")
        self.assertEqual(captured["timeout"], 45)


if __name__ == "__main__":
    unittest.main()
