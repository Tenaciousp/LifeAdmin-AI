import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "AccountPanel.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")
HOOK_SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "hooks" / "use-api.ts"
HOOK_SOURCE = HOOK_SOURCE_PATH.read_text(encoding="utf-8")


class AccountPanelAccessibilityTests(unittest.TestCase):
    def test_account_inputs_have_programmatic_labels(self):
        for pair in (
            ('htmlFor="account-email"', 'id="account-email"'),
            ('htmlFor="account-password"', 'id="account-password"'),
            ('htmlFor="account-delete-password"', 'id="account-delete-password"'),
            ('htmlFor="account-delete-confirm"', 'id="account-delete-confirm"'),
        ):
            with self.subTest(input_id=pair[1]):
                self.assertIn(pair[0], SOURCE)
                self.assertIn(pair[1], SOURCE)

    def test_deletion_disclosure_exposes_state_and_relationship(self):
        self.assertIn('aria-expanded={showDelete}', SOURCE)
        self.assertIn('aria-controls="account-deletion-panel"', SOURCE)
        self.assertIn('id="account-deletion-panel"', SOURCE)
        self.assertIn('setShowDelete((visible) => !visible)', SOURCE)
        self.assertIn('{showDelete ? "Hide account settings" : "Account settings & deletion"}', SOURCE)

    def test_decorative_icons_are_hidden(self):
        self.assertIn('<ShieldCheck aria-hidden="true"', SOURCE)
        self.assertIn('<Trash2 aria-hidden="true"', SOURCE)

    def test_each_account_action_reports_its_own_busy_state(self):
        self.assertIn('useState<"register" | "login" | "logout" | "delete" | null>(null)', SOURCE)
        for action in ("register", "login", "logout", "delete"):
            with self.subTest(action=action):
                self.assertIn(f'busyAction === "{action}"', SOURCE)
        for label in (
            "Creating account...",
            "Signing in...",
            "Signing out...",
            "Deleting account...",
        ):
            with self.subTest(label=label):
                self.assertIn(label, SOURCE)
        self.assertGreaterEqual(SOURCE.count("aria-busy={busyAction ==="), 4)

    def test_destructive_confirmation_remains_required(self):
        self.assertIn('if (deleteConfirm !== "DELETE")', SOURCE)
        self.assertIn('disabled={isBusy || deleteConfirm !== "DELETE"}', SOURCE)

    def test_account_status_failure_is_not_treated_as_signed_out(self):
        self.assertIn('queryFn: ({ signal }) => fetcher("/api/auth/me", { signal }),', HOOK_SOURCE)
        self.assertNotIn('fetcher("/api/auth/me").catch', HOOK_SOURCE)
        self.assertIn('isError, refetch: retryAuth', SOURCE)
        self.assertLess(SOURCE.index('isError ? ('), SOURCE.index('auth?.authenticated ? ('))

    def test_account_status_loading_and_recovery_are_accessible(self):
        self.assertIn('role="status" aria-live="polite"', SOURCE)
        self.assertIn("Checking account status...", SOURCE)
        self.assertIn('role="alert"', SOURCE)
        self.assertIn("We could not check your account", SOURCE)
        self.assertIn('onClick={() => void retryAuth()}', SOURCE)
        self.assertIn("Try account check again", SOURCE)
        self.assertNotIn("if (isLoading) return null", SOURCE)


if __name__ == "__main__":
    unittest.main()
