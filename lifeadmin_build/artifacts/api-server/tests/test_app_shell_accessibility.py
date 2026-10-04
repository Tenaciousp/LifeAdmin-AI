import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src"
APP = (ROOT / "App.tsx").read_text(encoding="utf-8")
BOUNDARY = (ROOT / "components" / "error-boundary.tsx").read_text(encoding="utf-8")
CONSENT = (ROOT / "components" / "AnalyticsConsent.tsx").read_text(encoding="utf-8")


class AppShellAccessibilityTests(unittest.TestCase):
    def test_route_loading_state_is_announced(self):
        self.assertIn('role="status"', APP)
        self.assertIn('aria-busy="true"', APP)
        self.assertIn("Loading…", APP)

    def test_not_found_view_uses_landmark_and_reachable_home_link(self):
        self.assertIn("<main", APP)
        self.assertIn('aria-labelledby="not-found-heading"', APP)
        self.assertIn('id="not-found-heading"', APP)
        self.assertIn("min-h-[44px]", APP)
        self.assertIn("focus-visible:ring-2", APP)

    def test_error_boundary_is_announced_and_recovery_is_touch_sized(self):
        self.assertIn('role="alert"', BOUNDARY)
        self.assertIn('aria-labelledby="app-error-heading"', BOUNDARY)
        self.assertIn('id="app-error-heading"', BOUNDARY)
        self.assertIn("min-h-[44px]", BOUNDARY)
        self.assertIn("focus-visible:ring-2", BOUNDARY)

    def test_consent_dialog_has_visible_name_and_description(self):
        self.assertIn('aria-labelledby="analytics-consent-heading"', CONSENT)
        self.assertIn('aria-describedby="analytics-consent-description"', CONSENT)
        self.assertIn('id="analytics-consent-heading"', CONSENT)
        self.assertIn('id="analytics-consent-description"', CONSENT)

    def test_stored_consent_is_loaded_before_first_paint(self):
        state_start = CONSENT.index("useState<string | null>(() =>")
        choice_handler = CONSENT.index("const choose", state_start)
        initialiser = CONSENT[state_start:choice_handler]
        self.assertIn("localStorage.getItem(CONSENT_KEY)", initialiser)
        self.assertNotIn("useEffect", CONSENT)


if __name__ == "__main__":
    unittest.main()
