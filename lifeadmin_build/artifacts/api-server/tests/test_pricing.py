import unittest
from unittest.mock import patch

import app


class SimplifiedPricingTests(unittest.TestCase):
    def test_only_core_and_all_access_are_for_sale(self):
        self.assertEqual(app.VALID_PRODUCTS, {"core_app", "all_access"})
        self.assertEqual([item["id"] for item in app.ADD_ONS], ["all_access"])
        self.assertEqual(app.CORE_PRODUCT["amount_pence"], 99)
        self.assertEqual(app.ALL_ACCESS_PRODUCT["amount_pence"], 199)

    def test_every_advanced_mode_requires_all_access(self):
        self.assertEqual(set(app.MODE_REQUIREMENTS), app.ADVANCED_MODES)
        self.assertTrue(all(product == "all_access" for product in app.MODE_REQUIREMENTS.values()))

    def test_store_and_stripe_mappings_are_exposed(self):
        for product in (app.CORE_PRODUCT, app.ALL_ACCESS_PRODUCT):
            self.assertTrue(product["price_env"].startswith("STRIPE_PRICE_"))
            self.assertTrue(product["apple_product_id"])
            self.assertTrue(product["google_product_id"])

    def test_legacy_pack_purchase_grants_all_access(self):
        with patch.object(app, "is_database_user", return_value=False), \
             patch.object(app, "load_purchase_store", return_value={"users": {"legacy": {"renewal_pro": True}}, "stripe_sessions": {}}):
            self.assertTrue(app.get_user_purchases("legacy")["all_access"])


if __name__ == "__main__":
    unittest.main()