"""
POST /score — real-time event scoring endpoint (hot path).

This is the performance-critical path. It must complete in milliseconds
because it's called for every incoming event in a real deployment.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, HTTPException, Request

from app.schemas.alert import ScoreRequest, ScoreResponse
from app.db import insert_alert
from app.ml.drift import get_baseline_type
from app.api.ws import manager

router = APIRouter()


@router.post("/score", response_model=ScoreResponse)
async def score_event_endpoint(
    payload: ScoreRequest,
    request: Request,
):
    from app.ml.anomaly_model import score_event
    from app.ml.classifier import classify_event
    from app.ml.explainability import (
        compute_risk_score, reason_string, top_anomaly_deviations
    )
    from app.ml.features import extract_features_for_row

    # Access models from FastAPI's app.state — always the correct instance
    state = request.app.state

    # Guard: if models failed to load at startup, return a clear 503
    if not getattr(state, "models_loaded", False):
        raise HTTPException(
            status_code=503,
            detail=(
                "ML models not loaded. "
                "Run 'python backend/app/ml/score_all.py' first, "
                "then restart the uvicorn server."
            ),
        )

    event_id = payload.event_id or str(uuid.uuid4())
    row = pd.Series(payload.model_dump())
    row["event_id"] = event_id

    baselines = state.baselines
    feature_cols = state.feature_cols

    # Build features for this single event (no window context — hot path)
    feats = extract_features_for_row(row=row, baselines=baselines)
    feats["action_enc"] = {"login": 0, "read": 1, "write": 2, "escalate": 3}.get(
        payload.action, 0)
    feats["auth_enc"] = {"password": 0, "mfa": 1, "sso": 2,
                         "certificate": 3, "api-key": 4}.get(payload.auth_method, 0)
    feats["session_duration_s"] = payload.session_duration_s
    feats["bytes_transferred"] = payload.bytes_transferred
    feats["success"] = int(payload.success)

    feat_df = pd.DataFrame([feats])
    # Align to training columns
    present = [c for c in feature_cols if c in feat_df.columns]
    feat_df = feat_df[present].fillna(0)

    # Layer 1
    anomaly_score = score_event(feat_df, state.if_model, state.if_scaler)

    # Layer 2
    pred_class, confidence = classify_event(
        feat_df, state.clf, state.clf_scaler, state.le)

    risk = compute_risk_score(anomaly_score, pred_class, confidence)

    deviations = top_anomaly_deviations(feat_df.iloc[0], present)
    reason = reason_string(
        attack_type=pred_class,
        risk_score=risk,
        feature_row=feat_df.iloc[0],
        anomaly_deviations=deviations,
        shap_attrs=deviations,
        raw_event=payload.model_dump(),
    )

    baseline_type = get_baseline_type(payload.user_id, baselines)

    # Store as alert if risk exceeds threshold
    alert_id = None
    if risk >= 40 or pred_class != "normal":
        alert_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        alert_payload = {
            "id": alert_id,
            "event_id": event_id,
            "timestamp": str(payload.timestamp),
            "user_id": payload.user_id,
            "device_id": payload.device_id,
            "source_ip": payload.source_ip,
            "geo_city": payload.geo_city,
            "geo_lat": payload.geo_lat,
            "geo_lon": payload.geo_lon,
            "resource_accessed": payload.resource_accessed,
            "action": payload.action,
            "auth_method": payload.auth_method,
            "session_duration_s": payload.session_duration_s,
            "bytes_transferred": payload.bytes_transferred,
            "success": int(payload.success),
            "risk_score": risk,
            "attack_type": pred_class,
            "confidence": confidence,
            "anomaly_score": anomaly_score,
            "reason": reason,
            "baseline_type": baseline_type,
            "cold_start": int(feats.get("cold_start", 0)),
            "status": "open",
            "true_label": None,
            "role": payload.role,
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
