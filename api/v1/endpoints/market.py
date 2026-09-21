# -*- coding: utf-8 -*-
"""Market monitor endpoints (US profit-taking signals)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from api.v1.schemas.market import UsProfitSnapshotResponse
from src.us_profit_monitor import get_snapshot

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/us-profit-signals",
    response_model=UsProfitSnapshotResponse,
    summary="US profit-taking signals",
    description=(
        "Live VIX, QQQ PE (Nasdaq-100), and CNN Fear & Greed readings with the "
        "triple-resonance profit-taking playbook."
    ),
)
def get_us_profit_signals(
    refresh: bool = Query(False, description="Bypass the short in-process cache"),
) -> UsProfitSnapshotResponse:
    snapshot = get_snapshot(use_cache=not refresh, force_refresh=refresh)
    return UsProfitSnapshotResponse(**snapshot.to_dict())
