# -*- coding: utf-8 -*-
"""Schemas for US profit-taking monitor API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SignalRule(BaseModel):
    condition: str
    label: str


class SignalReadingResponse(BaseModel):
    id: str
    name: str
    name_cn: str
    value: Optional[float] = None
    zone: str
    zone_label: str
    profit_taking: bool
    source: str
    rules: List[SignalRule] = Field(default_factory=list)
    error: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class ResonanceResponse(BaseModel):
    triggered_count: int
    triggered_ids: List[str] = Field(default_factory=list)
    level: str
    level_label: str
    emoji: str
    action: str


class UsProfitSnapshotResponse(BaseModel):
    updated_at: str = Field(..., description="America/New_York ISO timestamp")
    updated_at_cn: str = Field(..., description="Beijing time string")
    signals: List[SignalReadingResponse]
    resonance: ResonanceResponse
    disclaimer: str
    cached: bool = False
