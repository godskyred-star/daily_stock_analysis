# -*- coding: utf-8 -*-
"""
===================================
美股止盈监控命令
===================================

实时读取 VIX、QQQ PE、CNN Fear & Greed，按三共振法则输出操作建议。
"""

import logging
from typing import List

from bot.commands.base import BotCommand
from bot.models import BotMessage, BotResponse

logger = logging.getLogger(__name__)


class UsProfitCommand(BotCommand):
    """US profit-taking monitor command."""

    @property
    def name(self) -> str:
        return "usprofit"

    @property
    def aliases(self) -> List[str]:
        return ["止盈", "us-profit", "vix", "fng"]

    @property
    def description(self) -> str:
        return "美股止盈三信号实时监控"

    @property
    def usage(self) -> str:
        return "/usprofit"

    def execute(self, message: BotMessage, args: List[str]) -> BotResponse:
        try:
            from src.us_profit_monitor import format_markdown, get_snapshot

            snapshot = get_snapshot(use_cache=False, force_refresh=True)
            return BotResponse.markdown_response(format_markdown(snapshot))
        except Exception as exc:
            logger.exception("US profit monitor command failed: %s", exc)
            return BotResponse.error_response(f"美股止盈监控失败: {exc}")
