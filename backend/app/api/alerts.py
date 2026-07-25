"""Alert queue and detail endpoints."""

from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.db import get_alerts, get_alert_by_id
from app.schemas.alert import AlertsResponse, AlertSummary, Alert

router = APIRouter()


@router.get("/alerts", response_model=AlertsResponse)
def list_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    attack_type: Optional[str] = None,
    status: Optional[str] = None,
    min_risk: int = Query(0, ge=0, le=100),
):
    rows, total = get_alerts(
        page=page, limit=limit,
        attack_type=attack_type,
        status=status,
        min_risk=min_risk,
    )
    pages = max(1, math.ceil(total / limit))
    summaries = [AlertSummary(**r) for r in rows]
    return AlertsResponse(
        alerts=summaries, total=total,
        page=page, limit=limit, pages=pages,
    )


@router.get("/alerts/{alert_id}", response_model=Alert)
def get_alert(alert_id: str):
    row = get_alert_by_id(alert_id)
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return Alert(**row)
