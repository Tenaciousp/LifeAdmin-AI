import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "AccountPanel.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


def function_block(name, next_name):
    start = SOURCE.index(f"const {name}")
    end = SOURCE.index(f"\n\n  const {next_name}", start)
    return SOURCE[start:end]


class AccountSessionPrivacyRegressionTests(unittest.TestCase):
    def test_all_account_scoped_query_families_are_removed(self):
        start = SOURCE.index("const ACCOUNT_SCOPED_QUERY_KEYS")
        end = SOURCE.index("\n\nexport function AccountPanel", start)
        block = SOURCE[start:end]

        for query in (
            "/api/tasks",
            "/api/notes",
            "/api/products",
            "/api/admin/overview",
        ):
            self.assertIn(f'["{query}"]', block)

        self.assertNotIn("/api/catalog", block)
        self.assertIn("queryClient.removeQueries({ queryKey: [...queryKey] })", SOURCE)
        self.assertIn('queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] })', SOURCE)

    def test_successful_authentication_clears_credential_fields_after_response(self):
        block = function_block("handleAction", "handleLogout")
        self.assertLess(block.index("if (!res.ok)"), block.index("clearCredentialState()"))
        self.assertEqual(block.count("clearCredentialState()"), 1)
        self.assertLess(block.index("clearCredentialState()"), block.index("refreshAccountQueries()"))

    def test_logout_clears_credentials_before_refreshing_account_state(self):
        block = function_block("handleLogout", "handleDelete")
        self.assertLess(block.index("if (!res.ok)"), block.index("clearCredentialState()"))
        self.assertLess(block.index("clearCredentialState()"), block.index("refreshAccountQueries()"))

    def test_account_deletion_clears_all_sensitive_form_state(self):
        clear_block = function_block("clearCredentialState", "refreshAccountQueries")
        for setter in (
            'setEmail("")',
            'setPassword("")',
            'setDeleteConfirm("")',
            "setShowDelete(false)",
        ):
            self.assertIn(setter, clear_block)

        delete_start = SOURCE.index("const handleDelete")
        delete_end = SOURCE.index("\n\n  return (", delete_start)
        delete_block = SOURCE[delete_start:delete_end]
        self.assertLess(delete_block.index("if (!res.ok)"), delete_block.index("clearCredentialState()"))
        self.assertLess(delete_block.index("clearCredentialState()"), delete_block.index("refreshAccountQueries()"))


if __name__ == "__main__":
    unittest.main()
