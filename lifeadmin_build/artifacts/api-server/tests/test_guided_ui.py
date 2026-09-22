import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai"
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SOURCE = "\n".join(
    path.read_text(encoding="utf-8")
    for path in (ROOT / "src").rglob("*")
    if path.suffix in {".ts", ".tsx"}
)


class FrontendContractTests(unittest.TestCase):
    """Keep the active Vite entry and static client contract discoverable."""

    def test_active_vite_entry_is_accessible(self):
        self.assertIn('id="root"', HTML)
        self.assertIn('/src/main.tsx', HTML)

    def test_active_client_keeps_safe_result_and_account_actions(self):
        self.assertIn("/api/agent", SOURCE)
        self.assertIn("/api/auth/me", SOURCE)
        self.assertIn("provider_message", SOURCE)
        self.assertIn("Copy things to check", SOURCE)
        self.assertIn("Do not make the final decision for me.", SOURCE)


if __name__ == "__main__":
    unittest.main()