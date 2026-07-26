"""
POST /score — real-time event scoring endpoint (hot path).

This is the performance-critical path. It must complete in milliseconds
because it's called for every incoming event in a real deployment.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
import sys

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from app.schemas.alert import ScoreRequest, ScoreResponse
from app.db import insert_alert
from app.ml.drift import get_baseline_type
from app.api.ws import manager

router = APIRouter()


def _get_models():
    """Dependency — injected at request time from app state."""
    from app.main import app_state
    return app_state


@router.post("/score", response_model=ScoreResponse)
async def score_event_endpoint(
    request: ScoreRequest,
    state: dict = Depends(_get_models),
):
    from app.ml.anomaly_model import score_event
    from app.ml.classifier import classify_event
    from app.ml.explainability import (
        compute_risk_score, reason_string, top_anomaly_deviations
    )
    from app.ml.features import extract_features_for_row

    event_id = request.event_id or str(uuid.uuid4())
    row = pd.Series(request.model_dump())
    row["event_id"] = event_id

    # Guard: if models failed to load at startup, return a clear 503
    if "baselines" not in state or "if_model" not in state:
        raise HTTPException(
            status_code=503,
            detail=(
                "ML models not loaded. "
                "Run 'python backend/app/ml/score_all.py' first, "
                "then restart the uvicorn server."
            ),
        )

    baselines = state["baselines"]
    feature_cols = state["feature_cols"]

    # Build features for this single event (no window context — hot path)
    feats = extract_features_for_row(row=row, baselines=baselines)
    feats["action_enc"] = {"login": 0, "read": 1, "write": 2, "escalate": 3}.get(
        request.action, 0)
    feats["auth_enc"] = {"password": 0, "mfa": 1, "sso": 2,
                         "certificate": 3, "api-key": 4}.get(request.auth_method, 0)
    feats["session_duration_s"] = request.session_duration_s
    feats["bytes_transferred"] = request.bytes_transferred
    feats["success"] = int(request.success)

    feat_df = pd.DataFrame([feats])
    # Align to training columns
    present = [c for c in feature_cols if c in feat_df.columns]
    feat_df = feat_df[present].fillna(0)

    # Layer 1
    anomaly_score = score_event(feat_df, state["if_model"], state["if_scaler"])

    # Layer 2
    pred_class, confidence = classify_event(
        feat_df, state["clf"], state["clf_scaler"], state["le"])

    risk = compute_risk_score(anomaly_score, pred_class, confidence)

    deviations = top_anomaly_deviations(feat_df.iloc[0], present)
    reason = reason_string(
        attack_type=pred_class,
        risk_score=risk,
        feature_row=feat_df.iloc[0],
        anomaly_deviations=deviations,
        shap_attrs=deviations,
        raw_event=request.model_dump(),
    )

    baseline_type = get_baseline_type(request.user_id, baselines)

    # Store as alert if risk exceeds threshold
    alert_id = None
    if risk >= 40 or pred_class != "normal":
        alert_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        alert_payload = {
            "id": alert_id,
            "event_id": event_id,
            "timestamp": str(request.timestamp),
            "user_id": request.user_id,
            "device_id": request.device_id,
            "source_ip": request.source_ip,
            "geo_city": request.geo_city,
            "geo_lat": request.geo_lat,
            "geo_lon": request.geo_lon,
            "resource_accessed": request.resource_accessed,
            "action": request.action,
            "auth_method": request.auth_method,
            "session_duration_s": request.session_duration_s,
            "bytes_transferred": request.bytes_transferred,
            "success": int(request.success),
            "risk_score": risk,
            "attack_type": pred_class,
            "confidence": confidence,
            "anomaly_score": anomaly_score,
            "reason": reason,
            "baseline_type": baseline_type,
            "cold_start": int(feats.get("cold_start", 0)),
            "status": "open",
            "true_label": None,
            "role": request.role,
            "created_at": now,
        }
        insert_alert(alert_payload)
        # Broadcast to any connected frontend dashboard clients
        await manager.broadcast_alert(alert_payload)

    return ScoreResponse(
        event_id=event_id,
        risk_score=risk,
        attack_type=pred_class,
        confidence=confidence,
        anomaly_score=anomaly_score,
        reason=reason,
        baseline_type=baseline_type,
        alert_id=alert_id,
    )
