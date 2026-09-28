#!/usr/bin/env python3
"""Build a stable Option House fixture. Stdlib only. Seed 6886.

The latest session (2026-09-25) uses published aggregates. Earlier sessions are a
smooth random walk so ranks, 20-day averages, and sparklines are computable.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 6886
LATEST = date(2026, 9, 25)
DAY_COUNT = 140
OUT = Path(__file__).resolve().parents[1] / "data" / "report.json"

TIMES = [
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
]

INDEX = ["SPY", "QQQ", "IWM"]
ETF = ["TLT", "HYG", "IBIT", "XLU", "GLD", "SLV", "EEM", "SMH", "XLE", "ARKK"]
# Six published anchors plus the fill universe. The tape shows the top 25.
STOCK = [
    "TSLA",
    "NVDA",
    "AAPL",
    "MSFT",
    "META",
    "AMD",
    "AMZN",
    "GOOGL",
    "AVGO",
    "PLTR",
    "COIN",
    "BABA",
    "MU",
    "NFLX",
    "GME",
    "BA",
    "JPM",
    "BAC",
    "UBER",
    "SMCI",
    "ARM",
    "MSTR",
    "HOOD",
    "SOFI",
    "INTC",
    "RIVN",
]

STRIKE = {
    "SPY": 772,
    "QQQ": 600,
    "IWM": 240,
    "TLT": 80,
    "HYG": 75,
    "IBIT": 48,
    "XLU": 40,
    "GLD": 440,
    "SLV": 58,
    "EEM": 45,
    "SMH": 455,
    "XLE": 90,
    "ARKK": 50,
    "TSLA": 375,
    "NVDA": 225,
    "AAPL": 340,
    "MSFT": 510,
    "META": 720,
    "GME": 30,
    "AMD": 160,
    "AMZN": 190,
    "GOOGL": 170,
    "AVGO": 180,
    "PLTR": 40,
    "COIN": 200,
    "BABA": 90,
    "MU": 110,
    "NFLX": 700,
    "BA": 160,
    "JPM": 210,
    "BAC": 40,
    "UBER": 75,
    "SMCI": 45,
    "ARM": 140,
    "MSTR": 300,
    "HOOD": 25,
    "SOFI": 10,
    "INTC": 30,
    "RIVN": 14,
}

HEAT_LAST = [
    "SPY",
    "QQQ",
    "IWM",
    "TLT",
    "TSLA",
    "NVDA",
    "AAPL",
    "MSFT",
    "META",
    "HYG",
    "IBIT",
    "AMD",
    "AMZN",
    "GME",
    "XLU",
]


def weekdays_ending(end: date, count: int) -> list[date]:
    days: list[date] = []
    cursor = end
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return days


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def allocate(total: int, weights: list[float]) -> list[int]:
    """Split an integer total across positive weights. Sum is exact."""
    if not weights:
        return []
    safe = [w if w > 0 else 0.0001 for w in weights]
    scale = sum(safe)
    raw = [total * w / scale for w in safe]
    out = [int(v) for v in raw]
    left = total - sum(out)
    order = sorted(range(len(out)), key=lambda i: (raw[i] - out[i], -i), reverse=True)
    for i in range(left):
        out[order[i % len(out)]] += 1
    return out


def split_cp(volume: int, cp: float) -> tuple[int, int]:
    put = int(round(volume / (1.0 + cp)))
    put = min(max(put, 1), volume - 1)
    return volume - put, put


def sym_unit(symbol: str, salt: int) -> float:
    h = SEED
    for ch in symbol:
        h = (h * 33 + ord(ch) + salt) & 0xFFFFFFFF
    return ((h * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF


def contract_code(when: date, cp: float, symbol: str, salt: int = 0) -> str:
    side = "C" if cp >= 1 else "P"
    strike = STRIKE[symbol]
    nudge = int(sym_unit(symbol, salt) * 5) - 2
    strike = max(1, strike + nudge)
    return f"{when.month:02d}{when.day:02d}.{side}.{strike}"


def rebalance_calls(totals: list[int], calls: list[int], total_call: int, locked: int = 0) -> list[int]:
    """Make per-bucket calls sum to total_call without touching the locked prefix."""
    calls = calls[:]
    for i in range(locked, len(calls)):
        calls[i] = min(max(calls[i], 1), totals[i] - 1)
    drift = sum(calls) - total_call
    guard = 0
    while drift != 0 and guard < 10000:
        guard += 1
        if drift > 0:
            choices = [i for i in range(locked, len(calls)) if calls[i] > 1]
            if not choices:
                break
            i = max(choices, key=lambda k: calls[k])
            step = min(drift, calls[i] - 1)
            calls[i] -= step
            drift -= step
        else:
            choices = [i for i in range(locked, len(calls)) if calls[i] < totals[i] - 1]
            if not choices:
                break
            i = min(choices, key=lambda k: calls[k])
            step = min(-drift, totals[i] - 1 - calls[i])
            calls[i] += step
            drift += step
    if sum(calls) != total_call:
        raise RuntimeError(f"call split failed: {sum(calls)} != {total_call}")
    return calls


def buckets_from_totals(totals: list[int], total_call: int, curve: list[float], lock_first: tuple[int, int] | None):
    calls = []
    for i, total in enumerate(totals):
        cp = curve[i]
        call = int(round(total * cp / (1.0 + cp)))
        calls.append(call)
    if lock_first:
        calls[0] = lock_first[0]
    calls = rebalance_calls(totals, calls, total_call, locked=1 if lock_first else 0)
    rows = []
    for i, total in enumerate(totals):
        call = calls[i]
        rows.append({"t": TIMES[i], "total": total, "call": call, "put": total - call})
    return rows


def shape_weights(rng: random.Random) -> list[float]:
    templates = [
        [12, 10, 8, 7, 6, 6, 5, 5, 5, 6, 7, 8, 11],
        [14, 12, 9, 7, 6, 5, 5, 4, 4, 5, 6, 7, 8],
        [7, 7, 6, 6, 8, 11, 8, 6, 5, 6, 7, 8, 10],
        [6, 6, 5, 5, 6, 6, 6, 7, 8, 9, 10, 12, 14],
    ]
    base = templates[rng.randrange(len(templates))]
    return [max(0.4, w * (1 + rng.uniform(-0.12, 0.12))) for w in base]


def symbol_buckets(symbol: str, volume: int, rng: random.Random, pin: tuple[int, int] | None = None) -> list[int]:
    weights = shape_weights(rng)
    if symbol == "SPY":
        weights = [9.2, 10.4, 7.1, 6.4, 7.6, 12.8, 6.2, 4.4, 4.1, 4.6, 5.0, 5.6, 7.4]
    out = allocate(volume, weights)
    if not pin:
        return out
    index, pinned = pin
    out[index] = pinned
    drift = sum(out) - volume
    others = [i for i in range(len(out)) if i != index]
    guard = 0
    while drift != 0 and guard < volume + 5:
        guard += 1
        if drift > 0:
            i = max(others, key=lambda k: out[k])
            if out[i] <= 1:
                break
            step = min(drift, out[i] - 1)
            out[i] -= step
            drift -= step
        else:
            i = min(others, key=lambda k: out[k])
            room = pinned - 1 - out[i]
            if room <= 0:
                break
            step = min(-drift, room)
            out[i] += step
            drift += step
    if sum(out) != volume or out[index] != pinned or max(out) != pinned:
        raise RuntimeError(f"{symbol} heatmap pin failed: {out}")
    return out


def leader_row(symbol: str, volume: int, premium: int, cp: float, avg_size: int, hot: str, txn: int | None = None) -> dict:
    call, put = split_cp(volume, cp)
    if txn is None:
        txn = max(1, int(round(volume / max(avg_size, 1))))
    return {
        "symbol": symbol,
        "volume": int(volume),
        "txn": int(txn),
        "premium": int(premium),
        "call": int(call),
        "put": int(put),
        "cp": float(cp),
        "avgSize": int(avg_size),
        "hottestShort": hot,
    }


def build_digest(day: dict) -> list[str]:
    total = day["totalVol"]
    idx = day["categories"]["INDEX"]
    etf = day["categories"]["ETF"]
    stk = day["categories"]["STOCK"]

    def share(volume: int) -> str:
        return f"{100.0 * volume / total:.1f}%"

    def wan(volume: int) -> str:
        return f"{volume / 10000:.1f}"

    indexes = " · ".join(
        f"{row['symbol']} {wan(row['volume'])}万 CP{row['cp']:.2f}" for row in day["leaders"]["index"][:3]
    )
    etfs = " · ".join(f"{row['symbol']} {wan(row['volume'])}万" for row in day["leaders"]["etf"][:3])
    stocks = " · ".join(
        f"{row['symbol']} {wan(row['volume'])}万 CP{row['cp']:.2f}" for row in day["leaders"]["stock"][:5]
    )
    pool = [row for row in day["leaders"]["stock"] if row["volume"] >= 200_000]
    extreme = max(pool, key=lambda row: row["cp"])
    return [
        f"交易日 {day['date']}",
        f"全市场 {wan(day['totalVol'])} 万张 · {day['totalTxn'] / 10000:.1f} 万笔 · CP {day['marketCp']:.2f}",
        (
            f"指数占 {share(idx['volume'])} CP {idx['cp']:.2f} | "
            f"ETF {share(etf['volume'])} CP {etf['cp']:.2f} | "
            f"个股 {share(stk['volume'])} CP {stk['cp']:.2f}"
        ),
        f"三大指数: {indexes}",
        f"ETF 头部: {etfs}",
        f"个股头部: {stocks}",
        f"极端看多: {extreme['symbol']} CP {extreme['cp']:.2f} ({wan(extreme['volume'])}万张)",
    ]


def build_flows(leaders: list[dict], heat: dict[str, list[int]]) -> list[dict]:
    ranked = sorted(leaders, key=lambda row: row["premium"], reverse=True)
    chosen: list[dict] = []
    seen: set[str] = set()

    def add(row: dict) -> None:
        if row["symbol"] in seen or len(chosen) >= 12:
            return
        seen.add(row["symbol"])
        chosen.append(row)

    for row in ranked[:9]:
        add(row)

    def ensure(pred) -> None:
        if any(pred(row) for row in chosen):
            return
        for row in ranked:
            if pred(row):
                add(row)
                return

    ensure(lambda row: row["cp"] <= 0.85)
    ensure(lambda row: row["cp"] >= 1.35)
    ensure(lambda row: row["avgSize"] >= 18)
    ensure(lambda row: row["avgSize"] <= 7)
    for row in ranked:
        add(row)
    cards = []
    for offset, row in enumerate(chosen):
        buckets = heat.get(row["symbol"])
        if buckets:
            clock = TIMES[max(range(13), key=lambda i: buckets[i])]
        else:
            clock = TIMES[min(12, offset)]
        if row["cp"] >= 1.35:
            side = "Bullish"
        elif row["cp"] <= 0.85:
            side = "Bearish"
        else:
            side = "Neutral"
        if row["avgSize"] >= 18:
            structure = "Block"
        elif row["avgSize"] <= 7:
            structure = "Sweep"
        else:
            structure = "Split"
        cards.append(
            {
                "time": clock,
                "symbol": row["symbol"],
                "side": side,
                "structure": structure,
                "premium": row["premium"],
                "contract": row["hottestShort"],
                "cp": row["cp"],
            }
        )
    return cards


def evolve(weights: dict[str, float], rng: random.Random) -> None:
    hot = rng.choice(list(weights))
    for key in weights:
        weights[key] = max(0.25, weights[key] * (1 + rng.gauss(0, 0.045)))
    weights[hot] *= 1.28


def build_history(days: list[date]) -> list[dict]:
    rng = random.Random(SEED)
    weights = {symbol: 1.0 for symbol in INDEX + ETF + STOCK}
    for symbol, bias in {
        "SPY": 5.2,
        "QQQ": 3.4,
        "IWM": 1.4,
        "TLT": 2.4,
        "HYG": 1.6,
        "IBIT": 1.5,
        "TSLA": 4.0,
        "NVDA": 3.6,
        "AAPL": 2.2,
        "MSFT": 2.0,
        "META": 1.8,
    }.items():
        weights[symbol] = bias

    vol = 54_000_000.0
    cp_walk = 1.32
    ppc = 370.0
    idx_share = 0.36
    etf_share = 0.11
    records = []
    # History excludes the published final session; that one is overwritten later.
    for when in days[:-1]:
        vol = clamp(vol + rng.gauss(0, 1_500_000) + (56_000_000 - vol) * 0.04, 45_000_000, 70_000_000)
        cp_walk = clamp(cp_walk + rng.gauss(0, 0.025), 1.10, 1.60)
        ppc = clamp(ppc + rng.gauss(0, 6), 280, 520)
        idx_share = clamp(idx_share + rng.gauss(0, 0.008), 0.30, 0.46)
        etf_share = clamp(etf_share + rng.gauss(0, 0.004), 0.08, 0.16)
        evolve(weights, rng)
        total_vol = int(round(vol))
        put = int(round(total_vol / (1.0 + cp_walk)))
        total_call = total_vol - put
        market_cp = total_call / put
        avg_trade = clamp(6.2 + rng.gauss(0, 0.35), 4.5, 8.5)
        total_txn = max(1, int(round(total_vol / avg_trade)))
        total_premium = int(round(total_vol * ppc))
        idx_v = int(round(total_vol * idx_share))
        etf_v = int(round(total_vol * etf_share))
        stk_v = total_vol - idx_v - etf_v
        idx_cp = clamp(market_cp * 0.78 + rng.gauss(0, 0.02), 0.70, 1.35)
        etf_cp = clamp(market_cp * 0.96 + rng.gauss(0, 0.04), 0.55, 2.20)
        stk_cp = clamp(market_cp * 1.28 + rng.gauss(0, 0.05), 0.90, 2.60)
        # Premium mix leans toward single names, same idea as the published day.
        idx_p = int(round(total_premium * idx_share * rng.uniform(0.9, 1.05)))
        etf_p = int(round(total_premium * etf_share * rng.uniform(0.45, 0.75)))
        stk_p = total_premium - idx_p - etf_p
        groups = {
            "index": (INDEX, idx_v, idx_p, idx_cp),
            "etf": (ETF, etf_v, etf_p, etf_cp),
            "stock": (STOCK, stk_v, stk_p, stk_cp),
        }
        leaders: dict[str, list[dict]] = {}
        for name, (symbols, cat_v, cat_p, cat_cp) in groups.items():
            vols = allocate(cat_v, [weights[s] for s in symbols])
            raw_prem = []
            rows = []
            for symbol, volume in zip(symbols, vols):
                sym_cp = clamp(cat_cp * (0.72 + rng.random() * 0.7), 0.28, 8.5)
                if symbol == "XLU" and rng.random() < 0.15:
                    sym_cp = clamp(4 + rng.random() * 4, 3.5, 9.2)
                avg_size = rng.randint(3, 22)
                unit = clamp(ppc * (0.35 + rng.random() * 1.3), 40, 1100)
                raw_prem.append(max(1, int(volume * unit)))
                hot = contract_code(when, sym_cp, symbol, salt=when.toordinal() % 17)
                rows.append((symbol, volume, sym_cp, avg_size, hot))
            prems = allocate(cat_p, [float(v) for v in raw_prem])
            built = [
                leader_row(symbol, volume, premium, sym_cp, avg_size, hot)
                for (symbol, volume, sym_cp, avg_size, hot), premium in zip(rows, prems)
            ]
            built.sort(key=lambda row: row["volume"], reverse=True)
            leaders[name] = built
        curve = [clamp(market_cp * (1.15 - i * 0.02) + rng.uniform(-0.05, 0.05), 0.7, 2.2) for i in range(13)]
        totals = allocate(total_vol, shape_weights(rng))
        bucket_rows = buckets_from_totals(totals, total_call, curve, None)
        all_rows = [row for group in leaders.values() for row in group]
        heat_rows = sorted(all_rows, key=lambda row: row["volume"], reverse=True)[:15]
        heat_rng = random.Random(SEED + when.toordinal())
        heatmap = []
        heat_map: dict[str, list[int]] = {}
        for row in heat_rows:
            buckets = symbol_buckets(row["symbol"], row["volume"], heat_rng)
            heatmap.append({"symbol": row["symbol"], "buckets": buckets})
            heat_map[row["symbol"]] = buckets
        record = {
            "date": when.isoformat(),
            "totalVol": total_vol,
            "totalTxn": total_txn,
            "rowCount": max(1, int(round(total_vol * 0.0429))),
            "totalPremium": total_premium,
            "totalCall": total_call,
            "totalPut": put,
            "marketCp": market_cp,
            "categories": {
                "INDEX": {"volume": idx_v, "premium": idx_p, "cp": idx_cp},
                "ETF": {"volume": etf_v, "premium": etf_p, "cp": etf_cp},
                "STOCK": {"volume": stk_v, "premium": stk_p, "cp": stk_cp},
            },
            "buckets": bucket_rows,
            "leaders": leaders,
            "heatmap": heatmap,
        }
        record["flows"] = build_flows(all_rows, heat_map)
        record["digest"] = build_digest(record)
        records.append(record)
    return records


def build_last_day() -> dict:
    """Published 2026-09-25 anchors. Unspecified leaders are a decreasing book."""
    total_vol = 72_630_240
    total_txn = 11_731_791
    total_premium = 28_881_526_729
    total_call = 42_797_917
    total_put = 29_832_323
    market_cp = 1.4346156348602153
    categories = {
        "INDEX": {"volume": 28_497_473, "premium": 11_244_615_109, "cp": 1.0116777305811235},
        "ETF": {"volume": 7_416_245, "premium": 1_218_599_549, "cp": 1.2631582159602923},
        "STOCK": {"volume": 36_716_522, "premium": 16_418_312_071, "cp": 1.963553954180827},
    }
    # SPY is the published premium anchor ($2.16B). QQQ and IWM stay under it.
    # The rest of the index premium sits in names that are not on the three-row sheet.
    qqq_prem = 1_620_000_000
    iwm_prem = 280_000_000
    index_rows = [
        leader_row("SPY", 13_360_108, 2_158_729_363, 1.0225463652895095, 8, "0925.C.772", txn=1_640_915),
        leader_row("QQQ", 8_139_000, qqq_prem, 1.01, 22, "0925.C.600"),
        leader_row("IWM", 1_690_000, iwm_prem, 0.75, 6, "0925.C.240"),
    ]
    # SPY call/put are published; put the exact split back on the row.
    index_rows[0]["call"] = 6_754_520
    index_rows[0]["put"] = 6_605_588
    etf_spec = {
        "TLT": (1_667_263, 155_800_463, 2.338391857771299, 21, "1016.C.80"),
        "HYG": (709_000, None, 0.25, 12, "0115.P.75"),
        "IBIT": (551_000, None, 2.17, 6, "0925.C.48"),
        "XLU": (540_000, None, 9.58, 30, "1002.C.40"),
        "GLD": (500_000, None, 1.91, 8, "1218.C.440"),
        "SLV": (460_000, None, 1.85, 7, "0925.C.58"),
        "EEM": (420_000, None, 1.12, 11, "1016.C.45"),
        "SMH": (380_000, None, 0.37, 9, "1002.P.455"),
        "XLE": (340_000, None, 1.40, 15, "1016.C.90"),
        "ARKK": (300_000, None, 1.55, 5, "0925.C.50"),
    }
    etf_rows = []
    for symbol in ETF:
        volume, premium, cp, avg_size, hot = etf_spec[symbol]
        if premium is None:
            premium = int(volume * (90 + sym_unit(symbol, 3) * 220))
        etf_rows.append(leader_row(symbol, volume, premium, cp, avg_size, hot))
    etf_rows.sort(key=lambda row: row["volume"], reverse=True)
    stock_spec = {
        "TSLA": (3_160_395, 1_100_161_016, 1.7885231321435946, 5, "0925.C.375"),
        "NVDA": (2_845_000, 509_400_000, 2.25, 9, "0925.C.225"),
        "AAPL": (1_519_000, 328_200_000, 1.60, 6, "0925.C.340"),
        "MSFT": (1_502_000, 688_900_000, 2.29, 4, "0925.C.510"),
        "META": (1_225_000, 400_000_000, 1.59, 7, "0925.C.720"),
        "GME": (506_000, 49_300_000, 4.93, 9, "0925.C.30"),
    }
    ladder = [
        ("AMD", 980_000),
        ("AMZN", 910_000),
        ("GOOGL", 840_000),
        ("AVGO", 780_000),
        ("PLTR", 720_000),
        ("COIN", 670_000),
        ("BABA", 620_000),
        ("MU", 580_000),
        ("NFLX", 540_000),
        ("BA", 470_000),
        ("JPM", 440_000),
        ("BAC", 410_000),
        ("UBER", 380_000),
        ("SMCI", 350_000),
        ("ARM", 330_000),
        ("MSTR", 310_000),
        ("HOOD", 290_000),
        ("SOFI", 270_000),
        ("INTC", 250_000),
        ("RIVN", 230_000),
    ]
    stock_rows = []
    for symbol, volume in stock_spec.items():
        vol, premium, cp, avg_size, hot = stock_spec[symbol]
        stock_rows.append(leader_row(symbol, vol, premium, cp, avg_size, hot))
    for symbol, volume in ladder:
        cp = round(0.85 + sym_unit(symbol, 7) * 1.6, 2)
        avg_size = 4 + int(sym_unit(symbol, 9) * 10)
        premium = int(volume * (80 + sym_unit(symbol, 11) * 520))
        hot = f"0925.{'C' if cp >= 1 else 'P'}.{STRIKE[symbol]}"
        stock_rows.append(leader_row(symbol, volume, premium, cp, avg_size, hot))
    stock_rows.sort(key=lambda row: row["volume"], reverse=True)

    fixed = [
        8_737_439,
        8_460_000,
        6_172_000,
        5_445_000,
        5_648_000,
        7_162_000,
        4_369_000,
        3_433_000,
        3_499_000,
        4_050_000,
        4_470_000,
        5_180_000,
    ]
    totals = fixed + [total_vol - sum(fixed)]
    curve = [1.76, 1.70, 1.58, 1.46, 1.38, 1.30, 1.22, 1.16, 1.20, 1.28, 1.36, 1.44, 1.40]
    bucket_rows = buckets_from_totals(totals, total_call, curve, (5_575_592, 3_161_847))

    by_symbol = {row["symbol"]: row for row in index_rows + etf_rows + stock_rows}
    heat_rng = random.Random(SEED + 925)
    heatmap = []
    heat_map: dict[str, list[int]] = {}
    for symbol in HEAT_LAST:
        row = by_symbol[symbol]
        pin = (5, 1_744_000) if symbol == "SPY" else None
        buckets = symbol_buckets(symbol, row["volume"], heat_rng, pin=pin)
        heatmap.append({"symbol": symbol, "buckets": buckets})
        heat_map[symbol] = buckets

    record = {
        "date": LATEST.isoformat(),
        "totalVol": total_vol,
        "totalTxn": total_txn,
        "rowCount": 3_115_691,
        "totalPremium": total_premium,
        "totalCall": total_call,
        "totalPut": total_put,
        "marketCp": market_cp,
        "categories": categories,
        "buckets": bucket_rows,
        "leaders": {"index": index_rows, "etf": etf_rows, "stock": stock_rows},
        "heatmap": heatmap,
    }
    record["flows"] = build_flows(index_rows + etf_rows + stock_rows, heat_map)
    record["digest"] = build_digest(record)
    return record


def shape_into_band(records: list[dict]) -> None:
    """Lift the last 20 history sessions so the published day is about +8% vs 20D."""
    rng = random.Random(SEED + 20)
    band = records[-20:]
    for i, record in enumerate(band):
        target = 66_400_000 + i * 40_000 + int(rng.gauss(0, 700_000))
        target = int(clamp(target, 62_000_000, 69_800_000))
        scale_record(record, target)
    scale_record(records[-1], 67_312_549)


def scale_record(record: dict, new_vol: int) -> None:
    old = record["totalVol"]
    if old <= 0:
        return
    ratio = new_vol / old
    record["totalVol"] = new_vol
    record["totalTxn"] = max(1, int(round(record["totalTxn"] * ratio)))
    if record.get("rowCount"):
        record["rowCount"] = max(1, int(round(record["rowCount"] * ratio)))
    record["totalPremium"] = int(round(record["totalPremium"] * ratio))
    record["totalCall"] = int(round(record["totalCall"] * ratio))
    record["totalPut"] = new_vol - record["totalCall"]
    record["marketCp"] = record["totalCall"] / record["totalPut"]
    for name, cat in record["categories"].items():
        cat["volume"] = int(round(cat["volume"] * ratio))
        cat["premium"] = int(round(cat["premium"] * ratio))
    # Fix category volumes so they sum to the day.
    names = ["INDEX", "ETF", "STOCK"]
    drift = new_vol - sum(record["categories"][n]["volume"] for n in names)
    record["categories"]["STOCK"]["volume"] += drift
    prem_drift = record["totalPremium"] - sum(record["categories"][n]["premium"] for n in names)
    record["categories"]["STOCK"]["premium"] += prem_drift
    for name in names:
        rows = record["leaders"][name.lower()]
        cat_v = record["categories"][name]["volume"]
        cat_p = record["categories"][name]["premium"]
        vols = allocate(cat_v, [float(row["volume"]) for row in rows])
        prems = allocate(cat_p, [float(max(row["premium"], 1)) for row in rows])
        for row, volume, premium in zip(rows, vols, prems):
            row["volume"] = volume
            row["premium"] = premium
            row["txn"] = max(1, int(round(volume / max(row["avgSize"], 1))))
            call, put = split_cp(volume, row["cp"])
            row["call"] = call
            row["put"] = put
        rows.sort(key=lambda row: row["volume"], reverse=True)
    totals = allocate(new_vol, [float(b["total"]) for b in record["buckets"]])
    curve = []
    for bucket in record["buckets"]:
        put = bucket["put"] or 1
        curve.append(bucket["call"] / put)
    record["buckets"] = buckets_from_totals(totals, record["totalCall"], curve, None)
    heat_rng = random.Random(SEED + 4000 + new_vol % 997)
    heatmap = []
    heat_map: dict[str, list[int]] = {}
    top = sorted(
        [row for group in record["leaders"].values() for row in group],
        key=lambda row: row["volume"],
        reverse=True,
    )[:15]
    for row in top:
        buckets = symbol_buckets(row["symbol"], row["volume"], heat_rng)
        heatmap.append({"symbol": row["symbol"], "buckets": buckets})
        heat_map[row["symbol"]] = buckets
    record["heatmap"] = heatmap
    all_rows = [row for group in record["leaders"].values() for row in group]
    record["flows"] = build_flows(all_rows, heat_map)
    record["digest"] = build_digest(record)


def assert_last(day: dict) -> None:
    assert day["date"] == "2026-09-25"
    assert day["totalVol"] == 72_630_240
    assert day["totalTxn"] == 11_731_791
    assert day["totalPremium"] == 28_881_526_729
    assert day["totalCall"] == 42_797_917
    assert day["totalPut"] == 29_832_323
    assert abs(day["marketCp"] - 1.4346156348602153) < 1e-15
    assert abs(day["totalCall"] / day["totalPut"] - day["marketCp"]) < 1e-12
    idx = day["categories"]["INDEX"]
    etf = day["categories"]["ETF"]
    stk = day["categories"]["STOCK"]
    assert idx["volume"] == 28_497_473 and idx["premium"] == 11_244_615_109
    assert etf["volume"] == 7_416_245 and stk["volume"] == 36_716_522
    spy, qqq, iwm = day["leaders"]["index"]
    assert spy["symbol"] == "SPY" and spy["volume"] == 13_360_108
    assert spy["premium"] == 2_158_729_363 and spy["txn"] == 1_640_915
    assert spy["call"] == 6_754_520 and spy["put"] == 6_605_588
    assert spy["hottestShort"] == "0925.C.772" and spy["avgSize"] == 8
    assert qqq["volume"] == 8_139_000 and qqq["hottestShort"] == "0925.C.600"
    assert iwm["volume"] == 1_690_000 and abs(iwm["cp"] - 0.75) < 1e-9
    assert qqq["premium"] < spy["premium"] and iwm["premium"] < spy["premium"]
    anchor = max((row for group in day["leaders"].values() for row in group), key=lambda row: row["premium"])
    assert anchor["symbol"] == "SPY"
    assert day["rowCount"] == 3_115_691
    tlt = day["leaders"]["etf"][0]
    assert tlt["symbol"] == "TLT" and tlt["volume"] == 1_667_263
    assert tlt["premium"] == 155_800_463
    xlu = next(row for row in day["leaders"]["etf"] if row["symbol"] == "XLU")
    assert abs(xlu["cp"] - 9.58) < 1e-9
    tsla = day["leaders"]["stock"][0]
    assert tsla["symbol"] == "TSLA" and tsla["volume"] == 3_160_395
    assert tsla["premium"] == 1_100_161_016 and tsla["hottestShort"] == "0925.C.375"
    nvda = next(row for row in day["leaders"]["stock"] if row["symbol"] == "NVDA")
    assert nvda["volume"] == 2_845_000 and nvda["premium"] == 509_400_000
    gme = next(row for row in day["leaders"]["stock"] if row["symbol"] == "GME")
    assert gme["volume"] == 506_000 and abs(gme["cp"] - 4.93) < 1e-9
    assert gme["hottestShort"] == "0925.C.30"
    assert sum(b["total"] for b in day["buckets"]) == day["totalVol"]
    assert sum(b["call"] for b in day["buckets"]) == day["totalCall"]
    assert sum(b["put"] for b in day["buckets"]) == day["totalPut"]
    assert day["buckets"][0]["total"] == 8_737_439
    assert day["buckets"][0]["call"] == 5_575_592
    assert day["buckets"][0]["put"] == 3_161_847
    spy_heat = day["heatmap"][0]
    assert spy_heat["symbol"] == "SPY"
    assert sum(spy_heat["buckets"]) == spy["volume"]
    assert spy_heat["buckets"][5] == 1_744_000
    assert max(spy_heat["buckets"]) == 1_744_000
    assert "GME" in day["digest"][-1]
    assert len(day["flows"]) == 12
    symbols = [row["symbol"] for row in day["leaders"]["stock"]]
    for required in ["TSLA", "NVDA", "AAPL", "MSFT", "META", "GME", "AMD", "RIVN"]:
        assert required in symbols


def main() -> None:
    days = weekdays_ending(LATEST, DAY_COUNT)
    assert len(days) == DAY_COUNT
    assert days[-1] == LATEST
    assert all(d.weekday() < 5 for d in days)
    history = build_history(days)
    shape_into_band(history)
    last = build_last_day()
    records = history + [last]
    assert len(records) == DAY_COUNT
    assert_last(records[-1])
    # 20 sessions before the published day should sit near 67 million.
    prior = [row["totalVol"] for row in records[-21:-1]]
    assert len(prior) == 20
    mean20 = sum(prior) / 20
    assert 64_000_000 < mean20 < 70_000_000, mean20
    payload = {
        "meta": {
            "seed": SEED,
            "latest": LATEST.isoformat(),
            "generatedAt": "2026/9/26 10:02:40",
            "dayCount": DAY_COUNT,
            "rangeStart": records[0]["date"],
            "rangeEnd": records[-1]["date"],
            "times": TIMES,
            "note": "History is a seeded simulation. 2026-09-25 aggregates are published anchors.",
        },
        "days": records,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} days={len(records)} bytes={OUT.stat().st_size}")
    print(
        "last",
        last["totalVol"],
        last["marketCp"],
        "mean20",
        round(mean20),
        "vs20",
        round((last["totalVol"] / mean20 - 1) * 100, 2),
    )


if __name__ == "__main__":
    main()
