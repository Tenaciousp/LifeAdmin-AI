import pathlib
import unittest


SRC = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src"
LANDING = (SRC / "pages" / "LandingPage.tsx").read_text(encoding="utf-8")
ACCOUNT = (SRC / "components" / "AccountPanel.tsx").read_text(encoding="utf-8")
HOOKS = (SRC / "hooks" / "use-api.ts").read_text(encoding="utf-8")
JOURNEY = (SRC / "components" / "CustomerJourney.tsx").read_text(encoding="utf-8")
PRICING = (SRC / "components" / "PricingPanel.tsx").read_text(encoding="utf-8")
AUTH = (SRC / "lib" / "auth.ts").read_text(encoding="utf-8")


class AccountSwitchFrontendPrivacyTests(unittest.TestCase):
    def test_account_change_remounts_private_workspace_and_checkout(self):
        self.assertIn('const { data: auth, isError: authError, refetch: retryAuth } = useAuthMe()', LANDING)
        self.assertIn('auth?.authenticated && auth.user?.id ? auth.user.id : "guest"', LANDING)
        self.assertIn('<CustomerJourney key={workspaceKey} workspaceId={workspaceKey} />', LANDING)
        self.assertIn('<PricingPanel key={workspaceKey} workspaceId={workspaceKey} />', LANDING)

    def test_private_workspace_waits_for_successful_session_check(self):
        self.assertIn("const sessionReady = !!auth && !authError", LANDING)
        self.assertIn("sessionReady ? (", LANDING)
        self.assertIn("sessionReady ? <PricingPanel key={workspaceKey} workspaceId={workspaceKey} />", LANDING)
        self.assertIn("We could not check your session", LANDING)
        self.assertIn("Your work has not been changed.", LANDING)
        self.assertIn("Checking your session", LANDING)
        self.assertIn("Try session check again", LANDING)
        self.assertIn("onClick={() => void retryAuth()}", LANDING)
        self.assertIn('role={authError ? "alert" : "status"}', LANDING)

    def test_private_queries_use_workspace_identity_and_session_revalidation(self):
        self.assertIn('refetchOnWindowFocus: "always"', HOOKS)
        self.assertIn('refetchOnReconnect: "always"', HOOKS)
        for prefix in ('/api/tasks', '/api/notes', '/api/products'):
            self.assertIn(f'queryKey: ["{prefix}", userId, workspaceId]', HOOKS)
        self.assertIn('useTasks(buyerId, workspaceId)', JOURNEY)
        self.assertIn('useNotes(buyerId, workspaceId)', JOURNEY)
        self.assertIn('useProducts(buyerId, workspaceId)', PRICING)
        # Cancellation must abort actual HTTP requests, not only discard cached results.
        for endpoint in ('/api/auth/me', '/api/tasks', '/api/notes', '/api/products'):
            self.assertIn(f'queryFn: ({{ signal }}) => fetcher("{endpoint}", {{ signal }})', HOOKS)

    def test_account_transition_clears_old_queries_before_identity_update(self):
        start = ACCOUNT.index("const refreshAccountQueries = async (nextAuth:")
        end = ACCOUNT.index("\n  };", start)
        refresh = ACCOUNT[start:end]
        self.assertLess(refresh.index('await queryClient.cancelQueries({ queryKey: ["/api/auth/me"] })'), refresh.index("queryClient.setQueryData"))
        self.assertLess(refresh.index("await queryClient.cancelQueries({ queryKey: [...queryKey] })"), refresh.index("queryClient.removeQueries"))
        self.assertLess(refresh.index("queryClient.removeQueries"), refresh.index("queryClient.setQueryData"))
        self.assertIn('queryClient.setQueryData(["/api/auth/me"], nextAuth)', refresh)
        self.assertIn('queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] })', refresh)
        self.assertIn("await refreshAccountQueries(data)", ACCOUNT)
        self.assertEqual(ACCOUNT.count("await refreshAccountQueries({ authenticated: false })"), 2)

    def test_checkout_email_is_replaced_on_login_and_cleared_on_exit(self):
        self.assertIn("if (data.user?.email) saveBuyerEmail(data.user.email)", ACCOUNT)
        self.assertEqual(ACCOUNT.count("clearBuyerEmail();"), 2)
        self.assertIn("localStorage.removeItem('adminpilot_buyer_email')", AUTH)


if __name__ == "__main__":
    unittest.main()
