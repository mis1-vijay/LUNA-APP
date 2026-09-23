import unittest

from main import ensure_seed_data


class BackendContractTests(unittest.TestCase):
    def test_seed_data_populates_default_resources(self):
        result = ensure_seed_data()
        self.assertIn("departments", result)
        self.assertIn("resources", result)
        self.assertGreaterEqual(result["departments"], 1)
        self.assertGreaterEqual(result["resources"], 1)


if __name__ == "__main__":
    unittest.main()
