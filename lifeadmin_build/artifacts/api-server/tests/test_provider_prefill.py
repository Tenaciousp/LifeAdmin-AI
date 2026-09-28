import unittest

import domain


class ProviderPrefillRegressionTests(unittest.TestCase):
    def test_common_provider_suggestions_preserve_provider_prefill(self):
        cases = [
            ("Sky broadband price", "tv_broadband_mobile", "Sky"),
            ("Admiral car insurance renewal", "insurance", "Admiral"),
            ("Netflix cancel subscription", "subscriptions_memberships", "Netflix"),
        ]
        for query, category_id, provider in cases:
            with self.subTest(query=query):
                result = domain.suggest(query)
                self.assertEqual(result["category_id"], category_id)
                self.assertEqual(result["prefill_details"].get("provider"), provider)


if __name__ == "__main__":
    unittest.main()
