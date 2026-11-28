import io
import json
import os
import unittest
from unittest.mock import patch

import app


class RouteHandler:
    def __init__(self, body):
        raw = json.dumps(body).encode("utf-8")
        self.path = "/api/ai/comparison"
        self.headers = {"Content-Length": str(len(raw))}
        self.rfile = io.BytesIO(raw)
        self.wfile = io.BytesIO()
        self.client_address = ("synthetic-client", 1)
        self.status = None

    def send_response(self, status): self.status = status
    def send_header(self, name, value): pass
    def end_headers(self): pass
    def payload(self): return json.loads(self.wfile.getvalue().decode("utf-8"))


class LiveComparisonTests(unittest.TestCase):
    def route(self, body):
        handler = RouteHandler(body)
        app.AdminPilotHandler._do_POST(handler)
        return handler.status, handler.payload()

    def test_route_fails_closed_and_requires_explicit_consent(self):
        with patch.dict(os.environ, {"GEMINI_LIVE_COMPARISONS_ENABLED": "false"}, clear=False), \
             patch.object(app, "call_gemini_live_comparison") as generate:
            status, _ = self.route({"prompt": "Synthetic", "consent": True})
            self.assertEqual(status, 503)
            generate.assert_not_called()
        with patch.dict(os.environ, {"GEMINI_LIVE_COMPARISONS_ENABLED": "true", "GEMINI_API_KEY": "server-only"}, clear=False), \
             patch.object(app, "call_gemini_live_comparison") as generate:
            status, _ = self.route({"prompt": "Synthetic", "consent": False})
            self.assertEqual(status, 400)
            generate.assert_not_called()

    def test_route_rejects_oversized_and_rate_limited_requests(self):
        settings = {"GEMINI_LIVE_COMPARISONS_ENABLED": "true", "GEMINI_API_KEY": "server-only"}
        with patch.dict(os.environ, settings, clear=False), patch.object(app, "call_gemini_live_comparison") as generate:
            status, _ = self.route({"prompt": "x" * 20001, "consent": True})
            self.assertEqual(status, 400)
            with patch.object(app, "live_comparison_rate_limited", return_value=True):
                status, _ = self.route({"prompt": "Synthetic", "consent": True})
            self.assertEqual(status, 429)
            generate.assert_not_called()

    def test_consented_request_returns_only_validated_grounded_fields(self):
        body = {"prompt": "Synthetic bill details", "consent": True}
        expected = {"body": "Synthetic result", "sources": [{"title": "Provider", "url": "https://example.test/offer"}],
                    "citations": [], "search_suggestions_html": "<a>Related search</a>",
                    "checked_at": "2026-11-20T12:00:00+00:00", "model": "gemini-test"}
        with patch.dict(os.environ, {"GEMINI_LIVE_COMPARISONS_ENABLED": "true", "GEMINI_API_KEY": "server-only-secret"}, clear=False), \
             patch.object(app, "call_gemini_live_comparison", return_value=expected) as generate, \
             patch.object(app, "live_comparison_rate_limited", return_value=False):
            status, result = self.route(body)
        self.assertEqual(status, 200)
        self.assertEqual(result, expected)
        generate.assert_called_once_with(body["prompt"])
        self.assertNotIn("server-only-secret", json.dumps(result))

    def test_provider_call_uses_server_key_and_requires_search_evidence(self):
        result = {
            "candidates": [{"content": {"parts": [{"text": "Synthetic grounded result"}]}, "groundingMetadata": {
                "groundingChunks": [{"web": {"uri": "javascript:alert(1)", "title": "Invalid"}},
                                    {"web": {"uri": "https://example.test/offer", "title": "Example offer"}}],
                "groundingSupports": [{"segment": {"text": "Example fact"}, "groundingChunkIndices": [1]}],
                "searchEntryPoint": {"renderedContent": "<a>Related search</a>"},
            }}]
        }

        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self): return json.dumps(result).encode()

        captured = {}
        def open_request(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return Response()

        with patch.dict(os.environ, {"GEMINI_LIVE_COMPARISONS_ENABLED": "true", "GEMINI_API_KEY": "server-secret"}, clear=False), \
             patch.object(app.urllib.request, "urlopen", side_effect=open_request):
            actual = app.call_gemini_live_comparison("Synthetic comparison prompt")
        self.assertEqual(actual["body"], "Synthetic grounded result")
        self.assertEqual(actual["sources"][0]["url"], "https://example.test/offer")
        self.assertEqual(actual["citations"][0]["claim"], "Example fact")
        self.assertEqual(actual["search_suggestions_html"], "<a>Related search</a>")
        self.assertEqual(captured["request"].get_header("X-goog-api-key"), "server-secret")
        request = json.loads(captured["request"].data)
        self.assertEqual(request["contents"][0]["parts"][0]["text"], "Synthetic comparison prompt")
        self.assertEqual(request["tools"], [{"google_search": {}}])
        self.assertEqual(captured["timeout"], 60)

        incomplete = {"candidates": [{"content": {"parts": [{"text": "Ungrounded result"}]}, "groundingMetadata": {}}]}
        with patch.dict(os.environ, {"GEMINI_LIVE_COMPARISONS_ENABLED": "true", "GEMINI_API_KEY": "server-secret"}, clear=False), \
             patch.object(app.urllib.request, "urlopen", return_value=type("Response", (), {
                 "__enter__": lambda self: self, "__exit__": lambda self, *_: False,
                 "read": lambda self: json.dumps(incomplete).encode(),
             })()):
            with self.assertRaisesRegex(RuntimeError, "comparison failed"):
                app.call_gemini_live_comparison("Synthetic prompt")


if __name__ == "__main__":
    unittest.main()
