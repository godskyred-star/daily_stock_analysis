# -*- coding: utf-8 -*-
"""API tests for US profit-taking monitor endpoint."""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

try:
    import litellm  # noqa: F401
except ModuleNotFoundError:
    sys.modules["litellm"] = MagicMock()

from api.app import create_app
from src.config import Config
from src.us_profit_monitor import SignalReading, build_snapshot, evaluate_resonance


class UsProfitSignalsApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.env_path = self.data_dir / ".env"
        self.env_path.write_text("STOCK_LIST=AAPL\nGEMINI_API_KEY=test\n", encoding="utf-8")
        os.environ["ENV_FILE"] = str(self.env_path)
        os.environ["DATABASE_PATH"] = str(self.data_dir / "test.db")
        Config.reset_instance()
        app = create_app(static_dir=self.data_dir / "empty-static")
        self.client = TestClient(app)

    def tearDown(self) -> None:
        Config.reset_instance()
        os.environ.pop("ENV_FILE", None)
        os.environ.pop("DATABASE_PATH", None)
        self.temp_dir.cleanup()

    def test_us_profit_signals_endpoint_returns_snapshot(self) -> None:
        snapshot = build_snapshot(
            vix=SignalReading(
                id="vix",
                name="VIX",
                name_cn="标普恐慌指数",
                value=19.0,
                zone="hold",
                zone_label="正常持有",
                profit_taking=False,
                source="test",
                rules=[{"condition": "VIX 15-20", "label": "正常持有"}],
            ),
            qqq_pe=SignalReading(
                id="qqq_pe",
                name="QQQ PE",
                name_cn="纳指100市盈率",
                value=31.0,
                zone="expensive",
                zone_label="偏贵",
                profit_taking=False,
                source="test",
                rules=[{"condition": "PE 30-35", "label": "偏贵"}],
            ),
            fear_greed=SignalReading(
                id="fear_greed",
                name="Fear & Greed",
                name_cn="恐惧与贪婪指数",
                value=42.0,
                zone="fear",
                zone_label="偏恐惧，可关注",
                profit_taking=False,
                source="test",
                rules=[{"condition": "< 25", "label": "重点寻找机会"}],
            ),
        )
        with patch("api.v1.endpoints.market.get_snapshot", return_value=snapshot):
            response = self.client.get("/api/v1/market/us-profit-signals")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["resonance"]["triggered_count"], 0)
        self.assertEqual(data["resonance"]["level"], "normal")
        self.assertEqual(len(data["signals"]), 3)
        self.assertEqual(data["signals"][0]["name"], "VIX")
        self.assertIn("不构成投资建议", data["disclaimer"])

    def test_evaluate_resonance_used_by_snapshot(self) -> None:
        result = evaluate_resonance(
            [
                SignalReading(
                    id="vix", name="VIX", name_cn="VIX", value=13, zone="x",
                    zone_label="x", profit_taking=True, source="t",
                ),
                SignalReading(
                    id="qqq_pe", name="PE", name_cn="PE", value=36, zone="x",
                    zone_label="x", profit_taking=True, source="t",
                ),
                SignalReading(
                    id="fear_greed", name="FG", name_cn="FG", value=81, zone="x",
                    zone_label="x", profit_taking=True, source="t",
                ),
            ]
        )
        self.assertEqual(result.level, "extreme")


if __name__ == "__main__":
    unittest.main()
