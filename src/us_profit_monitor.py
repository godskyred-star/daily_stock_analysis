# -*- coding: utf-8 -*-
"""US-stock profit-taking monitor based on VIX, QQQ PE, and CNN Fear & Greed.

The three-signal rule and the triple-resonance playbook are encoded here so
WebUI, CLI, GitHub Actions, bots, and Agent tools share one evaluation path.
"""

from __future__ import annotations

import json
import logging
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

CNN_FEAR_GREED_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
YAHOO_QUOTE_SUMMARY_URL = "https://query1.finance.yahoo.com/v10/finance/quoteSummary/QQQ"
YAHOO_QUOTE_FALLBACK_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/QQQ"

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

CACHE_TTL_SECONDS = 15
HTTP_TIMEOUT_SECONDS = 12
DEFAULT_LOCAL_SCHEDULE_TIMES = "08:00,21:00"
_HHMM_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")

# Profit-taking triggers from the posted rule card.
VIX_PROFIT_TAKING_MAX = 14.0
QQQ_PE_PROFIT_TAKING_MIN = 35.0
FEAR_GREED_PROFIT_TAKING_MIN = 80.0

VIX_RULES = [
    {"condition": "VIX > 30", "label": "重点考虑买入"},
    {"condition": "VIX 15-20", "label": "正常持有"},
    {"condition": "VIX < 14", "label": "开始关注止盈"},
]
QQQ_PE_RULES = [
    {"condition": "PE < 30", "label": "估值合理"},
    {"condition": "PE 30-35", "label": "偏贵"},
    {"condition": "PE > 35", "label": "进入止盈区"},
]
FEAR_GREED_RULES = [
    {"condition": "< 25", "label": "重点寻找机会"},
    {"condition": "50-75", "label": "正常持有"},
    {"condition": ">= 80", "label": "考虑分批止盈"},
]

RESONANCE_PLAYBOOK = {
    0: {
        "level": "normal",
        "level_label": "正常",
        "emoji": "✅",
        "action": "三指标均未进入止盈区，按计划持有，无需因单一噪声调仓。",
    },
    1: {
        "level": "mild",
        "level_label": "轻度过热",
        "emoji": "⚠️",
        "action": "持股不动，或者仅对涨幅过夸的个股进行微调。",
    },
    2: {
        "level": "moderate",
        "level_label": "中度危险",
        "emoji": "🚨",
        "action": "执行一档止盈。比如减掉 20% 仓位，锁定部分利润。",
    },
    3: {
        "level": "extreme",
        "level_label": "极度疯狂",
        "emoji": "💣",
        "action": (
            "执行大额止盈。至少将仓位降至 50% 以下，或通过定投式分批卖出，"
            "保留大量现金等待暴跌后的抄底机会。"
        ),
    },
}

_CACHE_LOCK = threading.Lock()
_SNAPSHOT_CACHE: Dict[str, Any] = {"expires_at": 0.0, "snapshot": None}


@dataclass
class SignalReading:
    """One live indicator and the zone it currently sits in."""

    id: str
    name: str
    name_cn: str
    value: Optional[float]
    zone: str
    zone_label: str
    profit_taking: bool
    source: str
    rules: List[Dict[str, str]] = field(default_factory=list)
    error: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "name": self.name,
            "name_cn": self.name_cn,
            "value": self.value,
            "zone": self.zone,
            "zone_label": self.zone_label,
            "profit_taking": self.profit_taking,
            "source": self.source,
            "rules": self.rules,
            "error": self.error,
        }
        if self.extra:
            payload["extra"] = self.extra
        return payload


@dataclass
class ResonanceResult:
    """Triple-resonance status derived from profit-taking triggers."""

    triggered_count: int
    triggered_ids: List[str]
    level: str
    level_label: str
    emoji: str
    action: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "triggered_count": self.triggered_count,
            "triggered_ids": self.triggered_ids,
            "level": self.level,
            "level_label": self.level_label,
            "emoji": self.emoji,
            "action": self.action,
        }


@dataclass
class UsProfitSnapshot:
    """Point-in-time reading of the three US profit-taking signals."""

    updated_at: str
    updated_at_cn: str
    signals: List[SignalReading]
    resonance: ResonanceResult
    disclaimer: str = "仅供参考，不构成投资建议。"
    cached: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "updated_at": self.updated_at,
            "updated_at_cn": self.updated_at_cn,
            "signals": [item.to_dict() for item in self.signals],
            "resonance": self.resonance.to_dict(),
            "disclaimer": self.disclaimer,
            "cached": self.cached,
        }

    def signal_map(self) -> Dict[str, SignalReading]:
        return {item.id: item for item in self.signals}

    def format_value(self, signal_id: str) -> str:
        reading = self.signal_map().get(signal_id)
        if reading is None or reading.value is None:
            return "N/A"
        if signal_id == "fear_greed":
            return str(int(round(reading.value)))
        return f"{reading.value:.1f}"


def parse_hhmm_times(
    raw: Optional[str],
    default: str = DEFAULT_LOCAL_SCHEDULE_TIMES,
) -> List[str]:
    """Parse comma-separated HH:MM times used by the local scheduler.

    Invalid tokens are skipped. If nothing valid remains, fall back to 08:00,21:00
    (Beijing-oriented local clock: after US close, and near US cash-session open).
    """
    source = (raw or "").strip() or default
    times: List[str] = []
    seen = set()
    for part in source.split(","):
        token = part.strip()
        if not token:
            continue
        match = _HHMM_RE.match(token)
        if not match:
            logger.warning("Ignore invalid US profit monitor schedule time: %r", token)
            continue
        normalized = f"{int(match.group(1)):02d}:{match.group(2)}"
        if normalized in seen:
            continue
        seen.add(normalized)
        times.append(normalized)
    if times:
        return times
    if source != default:
        logger.warning(
            "No valid US profit monitor schedule times in %r; falling back to %s",
            raw,
            default,
        )
        return parse_hhmm_times(default, default=default)
    return ["08:00", "21:00"]


def classify_vix(value: float) -> Tuple[str, str, bool]:
    """Map VIX to zone, Chinese label, and profit-taking flag."""
    if value < VIX_PROFIT_TAKING_MAX:
        return "profit_taking", "开始关注止盈", True
    if value < 15:
        return "watch", "接近止盈关注区", False
    if value <= 20:
        return "hold", "正常持有", False
    if value <= 30:
        return "elevated", "波动偏高，观望", False
    return "buy", "重点考虑买入", False


def classify_qqq_pe(value: float) -> Tuple[str, str, bool]:
    """Map Nasdaq-100 / QQQ PE to valuation zone."""
    if value > QQQ_PE_PROFIT_TAKING_MIN:
        return "profit_taking", "进入止盈区", True
    if value >= 30:
        return "expensive", "偏贵", False
    return "reasonable", "估值合理", False


def classify_fear_greed(value: float) -> Tuple[str, str, bool]:
    """Map CNN Fear & Greed score to sentiment zone."""
    if value >= FEAR_GREED_PROFIT_TAKING_MIN:
        return "profit_taking", "考虑分批止盈", True
    if value > 75:
        return "greed", "贪婪升温", False
    if value >= 50:
        return "hold", "正常持有", False
    if value < 25:
        return "opportunity", "重点寻找机会", False
    return "fear", "偏恐惧，可关注", False


def evaluate_resonance(signals: List[SignalReading]) -> ResonanceResult:
    """Count profit-taking triggers and select the triple-resonance playbook."""
    triggered_ids = [item.id for item in signals if item.profit_taking]
    count = min(len(triggered_ids), 3)
    playbook = RESONANCE_PLAYBOOK[count]
    return ResonanceResult(
        triggered_count=count,
        triggered_ids=triggered_ids,
        level=playbook["level"],
        level_label=playbook["level_label"],
        emoji=playbook["emoji"],
        action=playbook["action"],
    )


def _now_stamps() -> Tuple[str, str]:
    ny = datetime.now(ZoneInfo("America/New_York"))
    cn = datetime.now(ZoneInfo("Asia/Shanghai"))
    return ny.isoformat(timespec="seconds"), cn.strftime("%Y-%m-%d %H:%M:%S")


def _http_get_json(
    url: str,
    *,
    params: Optional[Dict[str, str]] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = HTTP_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    import requests

    merged_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json,text/plain,*/*",
    }
    if headers:
        merged_headers.update(headers)
    response = requests.get(url, params=params, headers=merged_headers, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError(f"Unexpected JSON type from {url}: {type(payload).__name__}")
    return payload


def _extract_yahoo_pe(payload: Dict[str, Any]) -> Optional[float]:
    results = ((payload.get("quoteSummary") or {}).get("result") or [])
    if not results:
        return None
    detail = results[0]
    for module_name, key in (
        ("summaryDetail", "trailingPE"),
        ("defaultKeyStatistics", "trailingPE"),
        ("summaryDetail", "forwardPE"),
        ("defaultKeyStatistics", "forwardPE"),
    ):
        node = ((detail.get(module_name) or {}).get(key) or {})
        raw = node.get("raw") if isinstance(node, dict) else node
        if raw is None:
            continue
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue
        if value > 0:
            return value
    return None


def fetch_vix(http_get_json: Callable[..., Dict[str, Any]] = _http_get_json) -> SignalReading:
    """Fetch VIX from Yahoo Finance (yfinance fast_info, then history)."""
    del http_get_json  # interface kept consistent with the other fetchers
    error = None
    value: Optional[float] = None
    source = "yfinance"
    extra: Dict[str, Any] = {}
    try:
        import yfinance as yf

        ticker = yf.Ticker("^VIX")
        try:
            info = ticker.fast_info
            raw = getattr(info, "lastPrice", None) or getattr(info, "last_price", None)
            if raw is not None:
                value = float(raw)
                extra["method"] = "fast_info"
        except Exception as exc:
            logger.debug("VIX fast_info failed: %s", exc)
        if value is None:
            hist = ticker.history(period="5d")
            if hist is not None and not hist.empty and "Close" in hist.columns:
                value = float(hist["Close"].iloc[-1])
                extra["method"] = "history"
        if value is None:
            error = "Yahoo Finance 未返回 VIX 价格"
    except Exception as exc:
        error = str(exc)
        logger.warning("Failed to fetch VIX: %s", exc)

    if value is None:
        return SignalReading(
            id="vix",
            name="VIX",
            name_cn="标普恐慌指数",
            value=None,
            zone="unknown",
            zone_label="数据暂缺",
            profit_taking=False,
            source=source,
            rules=VIX_RULES,
            error=error or "VIX 获取失败",
        )

    value = round(value, 1)
    zone, label, profit_taking = classify_vix(value)
    return SignalReading(
        id="vix",
        name="VIX",
        name_cn="标普恐慌指数",
        value=value,
        zone=zone,
        zone_label=label,
        profit_taking=profit_taking,
        source=source,
        rules=VIX_RULES,
        extra=extra,
    )


def fetch_qqq_pe(http_get_json: Callable[..., Dict[str, Any]] = _http_get_json) -> SignalReading:
    """Fetch Nasdaq-100 proxy PE from QQQ trailing/forward PE."""
    error = None
    value: Optional[float] = None
    source = "yahoo_quote_summary"
    extra: Dict[str, Any] = {}
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/quote/QQQ",
    }
    params = {"modules": "summaryDetail,defaultKeyStatistics"}
    for url in (YAHOO_QUOTE_SUMMARY_URL, YAHOO_QUOTE_FALLBACK_URL):
        try:
            payload = http_get_json(url, params=params, headers=headers)
            value = _extract_yahoo_pe(payload)
            if value is not None:
                extra["method"] = "quoteSummary"
                extra["field"] = "trailingPE"
                break
        except Exception as exc:
            error = str(exc)
            logger.debug("QQQ PE quoteSummary failed via %s: %s", url, exc)

    if value is None:
        try:
            import yfinance as yf

            info = yf.Ticker("QQQ").info or {}
            for key in ("trailingPE", "forwardPE"):
                raw = info.get(key)
                if raw is None:
                    continue
                candidate = float(raw)
                if candidate > 0:
                    value = candidate
                    source = "yfinance"
                    extra["method"] = "ticker.info"
                    extra["field"] = key
                    break
        except Exception as exc:
            error = str(exc)
            logger.warning("Failed to fetch QQQ PE via yfinance: %s", exc)

    if value is None:
        return SignalReading(
            id="qqq_pe",
            name="QQQ PE",
            name_cn="纳指100市盈率",
            value=None,
            zone="unknown",
            zone_label="数据暂缺",
            profit_taking=False,
            source=source,
            rules=QQQ_PE_RULES,
            error=error or "QQQ 市盈率获取失败",
        )

    value = round(value, 1)
    zone, label, profit_taking = classify_qqq_pe(value)
    return SignalReading(
        id="qqq_pe",
        name="QQQ PE",
        name_cn="纳指100市盈率",
        value=value,
        zone=zone,
        zone_label=label,
        profit_taking=profit_taking,
        source=source,
        rules=QQQ_PE_RULES,
        extra=extra,
    )


def fetch_fear_greed(http_get_json: Callable[..., Dict[str, Any]] = _http_get_json) -> SignalReading:
    """Fetch CNN Fear & Greed Index."""
    error = None
    value: Optional[float] = None
    extra: Dict[str, Any] = {}
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://edition.cnn.com/markets/fear-and-greed",
        "Origin": "https://edition.cnn.com",
    }
    try:
        payload = http_get_json(CNN_FEAR_GREED_URL, headers=headers)
        node = payload.get("fear_and_greed") or {}
        raw = node.get("score")
        if raw is not None:
            value = float(raw)
            extra["rating"] = node.get("rating")
            extra["timestamp"] = node.get("timestamp")
        elif isinstance(node, list) and node:
            last = node[-1]
            if isinstance(last, dict) and last.get("y") is not None:
                value = float(last["y"])
    except Exception as exc:
        error = str(exc)
        logger.warning("Failed to fetch CNN Fear & Greed: %s", exc)

    if value is None:
        return SignalReading(
            id="fear_greed",
            name="Fear & Greed",
            name_cn="恐惧与贪婪指数",
            value=None,
            zone="unknown",
            zone_label="数据暂缺",
            profit_taking=False,
            source="cnn",
            rules=FEAR_GREED_RULES,
            error=error or "CNN 恐惧贪婪指数获取失败",
        )

    value = round(value)
    zone, label, profit_taking = classify_fear_greed(value)
    return SignalReading(
        id="fear_greed",
        name="Fear & Greed",
        name_cn="恐惧与贪婪指数",
        value=float(value),
        zone=zone,
        zone_label=label,
        profit_taking=profit_taking,
        source="cnn",
        rules=FEAR_GREED_RULES,
        extra=extra,
    )


def build_snapshot(
    *,
    vix: Optional[SignalReading] = None,
    qqq_pe: Optional[SignalReading] = None,
    fear_greed: Optional[SignalReading] = None,
    http_get_json: Callable[..., Dict[str, Any]] = _http_get_json,
) -> UsProfitSnapshot:
    """Compose a snapshot from provided readings or by fetching live data."""
    readings: Dict[str, Optional[SignalReading]] = {
        "vix": vix,
        "qqq_pe": qqq_pe,
        "fear_greed": fear_greed,
    }
    fetchers: Dict[str, Callable[[], SignalReading]] = {
        "vix": lambda: fetch_vix(http_get_json=http_get_json),
        "qqq_pe": lambda: fetch_qqq_pe(http_get_json=http_get_json),
        "fear_greed": lambda: fetch_fear_greed(http_get_json=http_get_json),
    }
    missing = [key for key, value in readings.items() if value is None]
    if len(missing) == 1:
        key = missing[0]
        readings[key] = fetchers[key]()
    elif missing:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(fetchers[key]): key for key in missing}
            for future in as_completed(futures):
                key = futures[future]
                readings[key] = future.result()
    ordered = [readings["vix"], readings["qqq_pe"], readings["fear_greed"]]
    if any(item is None for item in ordered):
        raise RuntimeError("US profit snapshot is missing one or more signals")
    signals: List[SignalReading] = [item for item in ordered if item is not None]
    updated_at, updated_at_cn = _now_stamps()
    return UsProfitSnapshot(
        updated_at=updated_at,
        updated_at_cn=updated_at_cn,
        signals=signals,
        resonance=evaluate_resonance(signals),
    )


def get_snapshot(*, use_cache: bool = True, force_refresh: bool = False) -> UsProfitSnapshot:
    """Return a live (or briefly cached) snapshot for API/WebUI polling."""
    now_ts = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        cached = _SNAPSHOT_CACHE.get("snapshot")
        expires_at = float(_SNAPSHOT_CACHE.get("expires_at") or 0.0)
        if use_cache and not force_refresh and cached is not None and now_ts < expires_at:
            cached.cached = True
            return cached

    snapshot = build_snapshot()
    with _CACHE_LOCK:
        _SNAPSHOT_CACHE["snapshot"] = snapshot
        _SNAPSHOT_CACHE["expires_at"] = now_ts + CACHE_TTL_SECONDS
    snapshot.cached = False
    return snapshot


def clear_snapshot_cache() -> None:
    """Reset the in-process snapshot cache (used by tests)."""
    with _CACHE_LOCK:
        _SNAPSHOT_CACHE["snapshot"] = None
        _SNAPSHOT_CACHE["expires_at"] = 0.0


def format_markdown(snapshot: UsProfitSnapshot) -> str:
    """Render a compact daily-monitor report matching the posted rule card."""
    vix = snapshot.format_value("vix")
    pe = snapshot.format_value("qqq_pe")
    fg = snapshot.format_value("fear_greed")
    signal_map = snapshot.signal_map()

    def _zone_line(signal_id: str) -> str:
        reading = signal_map.get(signal_id)
        if reading is None:
            return "数据暂缺"
        flag = "🔴 止盈区" if reading.profit_taking else "⚪"
        if reading.error:
            return f"{flag} {reading.zone_label}（{reading.error}）"
        return f"{flag} {reading.zone_label}"

    resonance = snapshot.resonance
    lines = [
        "# 美股止盈 · 三个重要信号",
        "",
        f"更新时间：{snapshot.updated_at_cn}（北京） / {snapshot.updated_at}（美东）",
        "",
        "| 指标 | 当前 | 状态 |",
        "|------|------|------|",
        f"| ① VIX 标普恐慌指数 | {vix} | {_zone_line('vix')} |",
        f"| ② QQQ PE 纳指100市盈率 | {pe} | {_zone_line('qqq_pe')} |",
        f"| ③ Fear & Greed 恐惧与贪婪指数 | {fg} | {_zone_line('fear_greed')} |",
        "",
        "## 三共振法则",
        "",
        f"{resonance.emoji} **{resonance.level_label}**（{resonance.triggered_count}/3 个指标进入止盈区）",
        "",
        resonance.action,
        "",
        "触发条件：VIX < 14、QQQ PE > 35、CNN Fear & Greed ≥ 80。",
        "",
        f"> {snapshot.disclaimer}",
    ]
    return "\n".join(lines)


def should_notify(snapshot: UsProfitSnapshot, min_triggers: int) -> bool:
    """Decide whether a scheduled run should push this snapshot."""
    if min_triggers <= 0:
        return True
    return snapshot.resonance.triggered_count >= min_triggers


def run_us_profit_monitor(
    *,
    send_notification: bool = True,
    force_notify: bool = False,
    notifier: Any = None,
) -> UsProfitSnapshot:
    """Fetch the live snapshot and optionally push it through NotificationService."""
    from src.config import get_config

    config = get_config()
    snapshot = get_snapshot(use_cache=False, force_refresh=True)
    markdown = format_markdown(snapshot)
    logger.info(
        "US profit monitor: VIX=%s PE=%s F&G=%s resonance=%s/%s",
        snapshot.format_value("vix"),
        snapshot.format_value("qqq_pe"),
        snapshot.format_value("fear_greed"),
        snapshot.resonance.triggered_count,
        snapshot.resonance.level,
    )

    if not send_notification:
        return snapshot

    min_triggers = int(getattr(config, "us_profit_monitor_notify_min_triggers", 1) or 0)
    notify_enabled = bool(getattr(config, "us_profit_monitor_notify", True))
    if not force_notify and not notify_enabled:
        logger.info("US profit monitor notify disabled by config")
        return snapshot
    if not force_notify and not should_notify(snapshot, min_triggers):
        logger.info(
            "US profit monitor skip notify: triggered=%s min_triggers=%s",
            snapshot.resonance.triggered_count,
            min_triggers,
        )
        return snapshot

    if notifier is None:
        from src.notification import NotificationService

        notifier = NotificationService()
    if not notifier.is_available():
        logger.warning("US profit monitor: no notification channel configured")
        return snapshot

    if notifier.send(markdown, email_send_to_all=True):
        logger.info("US profit monitor notification sent")
    else:
        logger.warning("US profit monitor notification failed")
    return snapshot


def run_local_us_profit_job(*, send_notification: bool = True) -> UsProfitSnapshot:
    """Entry point for the local scheduler / CLI daily job."""
    from src.notification import NotificationService

    notifier = NotificationService()
    return run_us_profit_monitor(
        send_notification=send_notification,
        notifier=notifier,
    )


def snapshot_to_json(snapshot: UsProfitSnapshot) -> str:
    """Serialize a snapshot for debugging / CLI dry prints."""
    return json.dumps(snapshot.to_dict(), ensure_ascii=False, indent=2)
