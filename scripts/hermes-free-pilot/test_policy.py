import copy
import unittest
from policy import MODEL, PolicyError, require_free, safe_completion, verified_usage


class ZeroFeePolicyTests(unittest.TestCase):
    def setUp(self):
        self.catalog = {"data": [{"id": MODEL, "pricing": {"prompt": "0", "completion": "0"}}]}

    def test_missing_paid_unknown_nonfinite_and_duplicate_prices_fail_closed(self):
        for price in ["0.000001", "-1", "NaN", "Infinity", None, {}, "unknown"]:
            data = copy.deepcopy(self.catalog)
            data["data"][0]["pricing"]["request"] = price
            with self.subTest(price=price), self.assertRaises(PolicyError):
                require_free(data, 100, 100)
        for data in [{}, {"data": []}, {"data": self.catalog["data"] * 2}, {"data": [{"id": MODEL, "pricing": {"prompt": "0"}}]}]:
            with self.assertRaises(PolicyError):
                require_free(data, 100, 100)

    def test_stale_or_future_catalog_rejected(self):
        for checked_at in [0, 101, float("nan")]:
            with self.assertRaises(PolicyError):
                require_free(self.catalog, checked_at, 100)
        self.assertEqual(require_free(self.catalog, 95, 100)["model"], MODEL)

    def test_caller_cannot_enable_paid_model_tool_plugin_or_fallback(self):
        base = {"model": MODEL, "messages": [{"role": "user", "content": "Planifier un accueil client"}]}
        for extra in [{"model": "paid-model"}, {"models": ["paid-model"]}, {"tools": [{"function": "paid"}]}, {"plugins": [{"id": "web"}]}, {"stream": True}]:
            with self.assertRaises(PolicyError):
                safe_completion({**base, **extra})
        safe = safe_completion({**base, "provider": {"allow_fallbacks": True}, "api_key": "injected", "max_tokens": 100000})
        self.assertEqual(safe["provider"], {"allow_fallbacks": False, "max_price": {"prompt": 0, "completion": 0}})
        self.assertEqual(safe["max_tokens"], 1536)
        self.assertNotIn("api_key", safe)

    def test_tool_history_and_oversize_context_rejected(self):
        for message in [{"role": "tool", "content": "execute"}, {"role": "user", "content": "x" * 100001}, {"role": "assistant", "content": "", "tool_calls": [{}]}]:
            with self.assertRaises(PolicyError):
                safe_completion({"model": MODEL, "messages": [message]})

    def test_only_effective_free_model_and_explicit_zero_cost_are_verified(self):
        for result in [{"model": MODEL}, {"model": "paid-model", "usage": {"cost": 0}}, {"model": MODEL, "usage": {"cost": "0.001"}}]:
            with self.assertRaises(PolicyError):
                verified_usage(result)
        self.assertEqual(verified_usage({"model": MODEL.removesuffix(":free"), "usage": {"cost": 0}})["costUsd"], "0")


if __name__ == "__main__":
    unittest.main()
