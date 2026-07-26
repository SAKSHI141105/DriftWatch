"""POST /alerts/{alert_id}/feedback — analyst feedback endpoint."""

from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.db import get_alert_by_id, update_alert_status, insert_feedback
from app.schemas.alert import FeedbackRequest

router = APIRouter()


@router.post("/alerts/{alert_id}/feedback")
def submit_feedback(alert_id: str, request: FeedbackRequest):
    if request.action not in ("confirm", "dismiss", "note"):
        raise HTTPException(status_code=400, detail="Action must be 'confirm', 'dismiss', or 'note'")

    alert = get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    new_status = alert.get("status", "open")
    if request.action == "confirm":
        new_status = "confirmed"
        update_alert_status(alert_id, new_status)
    elif request.action == "dismiss":
        new_status = "dismissed"
        update_alert_status(alert_id, new_status)

    now = datetime.now(timezone.utc).isoformat()
    insert_feedback(alert_id, request.action, request.note, now)

    return {"status": "success", "alert_id": alert_id, "new_status": new_status, "note": request.note}
