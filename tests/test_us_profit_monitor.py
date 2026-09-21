# -*- coding: utf-8 -*-
"""Unit tests for US profit-taking monitor rules and report formatting."""

import unittest
from unittest.mock import MagicMock, patch

from src.us_profit_monitor import (
    SignalReading,
    UsProfitSnapshot,
    build_snapshot,
    classify_fear_greed,
    classify_qqq_pe,
    classify_vix,
    evaluate_resonance,
    fetch_fear_greed,
    fetch_qqq_pe,
    format_markdown,
    should_notify,
)


def _signal(signal_id: str, value: float, profit_taking: bool) -> SignalReading:
    return SignalReading(
        id=signal_id,
        name=signal_id,
        name_cn=signal_id,
        value=value,
        zone="profit_taking" if profit_taking else "hold",
        zone_label="止盈" if profit_taking else "持有",
        profit_taking=profit_taking,
        source="test",
    )


class ClassifyRulesTestCase(unittest.TestCase):
    def test_vix_profit_taking_below_14(self):
        zone, label, triggered = classify_vix(13.9)
        self.assertEqual(zone, "profit_taking")
        self.assertTrue(triggered)
        self.assertIn("止盈", label)

    def test_vix_hold_band(self):
        zone, label, triggered = classify_vix(19)
        self.assertEqual(zone, "hold")
        self.assertFalse(triggered)
        self.assertEqual(label, "正常持有")

    def test_vix_buy_above_30(self):
        zone, label, triggered = classify_vix(31)
        self.assertEqual(zone, "buy")
        self.assertFalse(triggered)
        self.assertIn("买入", label)

    def test_qqq_pe_zones(self):
        self.assertEqual(classify_qqq_pe(29.9)[0], "reasonable")
        self.assertEqual(classify_qqq_pe(30)[0], "expensive")
        self.assertEqual(classify_qqq_pe(35)[0], "expensive")
        zone, label, triggered = classify_qqq_pe(35.1)
        self.assertEqual(zone, "profit_taking")
        self.assertTrue(triggered)
        self.assertIn("止盈", label)

    def test_fear_greed_zones(self):
        self.assertEqual(classify_fear_greed(24)[0], "opportunity")
        self.assertEqual(classify_fear_greed(42)[0], "fear")
        self.assertEqual(classify_fear_greed(50)[0], "hold")
        self.assertEqual(classify_fear_greed(75)[0], "hold")
        zone, label, triggered = classify_fear_greed(80)
        self.assertEqual(zone, "profit_taking")
        self.assertTrue(triggered)
        self.assertIn("止盈", label)


class ResonanceTestCase(unittest.TestCase):
    def test_zero_triggers_is_normal(self):
        result = evaluate_resonance(
            [
                _signal("vix", 19, False),
                _signal("qqq_pe", 31, False),
                _signal("fear_greed", 42, False),
            ]
        )
        self.assertEqual(result.triggered_count, 0)
        self.assertEqual(result.level, "normal")
        self.assertIn("持有", result.action)

    def test_one_trigger_is_mild(self):
        result = evaluate_resonance(
            [
                _signal("vix", 13, True),
                _signal("qqq_pe", 31, False),
                _signal("fear_greed", 42, False),
            ]
        )
        self.assertEqual(result.triggered_count, 1)
        self.assertEqual(result.level, "mild")
        self.assertEqual(result.triggered_ids, ["vix"])

    def test_two_triggers_is_moderate(self):
        result = evaluate_resonance(
            [
                _signal("vix", 13, True),
                _signal("qqq_pe", 36, True),
                _signal("fear_greed", 42, False),
            ]
        )
        self.assertEqual(result.triggered_count, 2)
        self.assertEqual(result.level, "moderate")
        self.assertIn("20%", result.action)

    def test_three_triggers_is_extreme(self):
        result = evaluate_resonance(
            [
                _signal("vix", 13, True),
                _signal("qqq_pe", 36, True),
                _signal("fear_greed", 81, True),
            ]
        )
        self.assertEqual(result.triggered_count, 3)
        self.assertEqual(result.level, "extreme")
        self.assertIn("50%", result.action)


class MarkdownAndNotifyTestCase(unittest.TestCase):
    def test_markdown_contains_current_values_and_disclaimer(self):
        snapshot = build_snapshot(
            vix=_signal("vix", 19.2, False),
            qqq_pe=_signal("qqq_pe", 31.4, False),
            fear_greed=_signal("fear_greed", 42, False),
        )
        markdown = format_markdown(snapshot)
        self.assertIn("美股止盈", markdown)
        self.assertIn("19.2", markdown)
        self.assertIn("31.4", markdown)
        self.assertIn("42", markdown)
        self.assertIn("正常", markdown)
        self.assertIn("不构成投资建议", markdown)

    def test_should_notify_respects_min_triggers(self):
        snapshot = UsProfitSnapshot(
            updated_at="2026-09-21T09:00:00-04:00",
            updated_at_cn="2026-09-21 21:00:00",
            signals=[
                _signal("vix", 13, True),
                _signal("qqq_pe", 31, False),
                _signal("fear_greed", 42, False),
            ],
            resonance=evaluate_resonance(
                [
                    _signal("vix", 13, True),
                    _signal("qqq_pe", 31, False),
                    _signal("fear_greed", 42, False),
                ]
            ),
        )
        self.assertTrue(should_notify(snapshot, 0))
        self.assertTrue(should_notify(snapshot, 1))
        self.assertFalse(should_notify(snapshot, 2))


class FetcherParseTestCase(unittest.TestCase):
    def test_fetch_qqq_pe_from_quote_summary(self):
        payload = {
            "quoteSummary": {
                "result": [
                    {
                        "summaryDetail": {"trailingPE": {"raw": 31.4}},
                        "defaultKeyStatistics": {},
                    }
                ]
            }
        }
        reading = fetch_qqq_pe(http_get_json=lambda *args, **kwargs: payload)
        self.assertEqual(reading.value, 31.4)
        self.assertEqual(reading.zone, "expensive")
        self.assertFalse(reading.profit_taking)

    def test_fetch_fear_greed_from_cnn_payload(self):
        payload = {"fear_and_greed": {"score": 42.2, "rating": "fear"}}
        reading = fetch_fear_greed(http_get_json=lambda *args, **kwargs: payload)
        self.assertEqual(reading.value, 42.0)
        self.assertEqual(reading.zone, "fear")
        self.assertEqual(reading.extra.get("rating"), "fear")

    def test_fetch_fear_greed_profit_taking_at_eighty(self):
        payload = {"fear_and_greed": {"score": 80}}
        reading = fetch_fear_greed(http_get_json=lambda *args, **kwargs: payload)
        self.assertTrue(reading.profit_taking)
        self.assertEqual(reading.zone, "profit_taking")

    def test_fetch_qqq_pe_error_when_payload_empty(self):
        fake_yf = MagicMock()
        ticker = MagicMock()
        ticker.info = {}
        fake_yf.Ticker.return_value = ticker
        with patch.dict("sys.modules", {"yfinance": fake_yf}):
            reading = fetch_qqq_pe(http_get_json=lambda *args, **kwargs: {})
        self.assertIsNone(reading.value)
        self.assertEqual(reading.zone, "unknown")
        self.assertIsNotNone(reading.error)


if __name__ == "__main__":
    unittest.main()
