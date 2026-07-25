"""
Pre-score synthetic events and populate the SQLite database.

Optimized vectorized batch scoring: runs model inference over all
100,000 events in batches in <1 second, filters to flagged alerts,
and generates human-readable explanations.
"""

from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from app.db import init_db, bulk_insert_alerts, get_alert_counts
from app.ml.anomaly_model import load_model_artifacts
from app.ml.classifier import load_classifier_artifacts
from app.ml.drift import get_baseline_type
from app.ml.explainability import (
    compute_risk_score,
    reason_string,
    top_anomaly_deviations,
)
from app.ml.features import build_features

DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "app" / "models"
ALERT_THRESHOLD = 40


def score_and_populate(batch_size: int = 500) -> None:
    print("Loading model artifacts...", flush=True)
    if_model, if_scaler, baselines, feature_cols = load_model_artifacts()
    clf, clf_scaler, le = load_classifier_artifacts()

    print("Loading synthetic data...", flush=True)
    df = pd.read_parquet(DATA_DIR / "access_logs.parquet")
    print(f"  {len(df):,} events loaded.", flush=True)

    print("Building feature matrix...", flush=True)
    t0 = time.time()
    X, y, merged = build_features(df, baselines)
    present_cols = [c for c in feature_cols if c in X.columns]
    X_aligned = X[present_cols].fillna(0)
    print(f"  Done in {time.time()-t0:.1f}s, shape={X_aligned.shape}", flush=True)

    print("Running vectorized model inference...", flush=True)
    t1 = time.time()
    # Vectorized Layer 1: anomaly scoring
    X_if_scaled = if_scaler.transform(X_aligned)
    raw_if_scores = if_model.decision_function(X_if_scaled)
    # Normalize decision function to [0, 1] anomaly score
    if_min, if_max = raw_if_scores.min(), raw_if_scores.max()
    if if_max > if_min:
        anomaly_scores = (raw_if_scores - if_min) / (if_max - if_min)
    else:
        anomaly_scores = np.zeros_like(raw_if_scores)

    # Vectorized Layer 2: XGBoost classification
    X_clf_scaled = clf_scaler.transform(X_aligned)
    pred_indices = clf.predict(X_clf_scaled)
    pred_classes = le.inverse_transform(pred_indices)
    proba = clf.predict_proba(X_clf_scaled)
    confidences = np.max(proba, axis=1)

    print(f"  Inference done in {time.time()-t1:.2f}s.", flush=True)

    print("Initialising database...", flush=True)
    init_db()

    print("Filtering and generating alert explanations...", flush=True)
    alerts_to_insert: list[dict] = []
    now_ts = pd.Timestamp.utcnow().isoformat()

    n_flagged = 0
    # We only process explanations and store alerts for suspicious events
    for idx in range(len(df)):
        pred_class = str(pred_classes[idx])
        anomaly_score = float(anomaly_scores[idx])
        confidence = float(confidences[idx])
        risk = compute_risk_score(anomaly_score, pred_class, confidence)

        if risk < ALERT_THRESHOLD and pred_class == "normal":
            continue

        raw = merged.iloc[idx]
        feat_row = X_aligned.iloc[idx]
        deviations = top_anomaly_deviations(feat_row, present_cols)
        baseline_type = get_baseline_type(str(raw["user_id"]), baselines)

        reason = reason_string(
            attack_type=pred_class,
            risk_score=risk,
            feature_row=feat_row,
            anomaly_deviations=deviations,
            shap_attrs=deviations,
            raw_event=raw.to_dict(),
        )

        alert = {
            "id": str(uuid.uuid4()),
            "event_id": str(raw["event_id"]),
            "timestamp": str(raw["timestamp"]),
            "user_id": str(raw["user_id"]),
            "device_id": str(raw["device_id"]),
            "source_ip": str(raw["source_ip"]),
            "geo_city": str(raw["geo_city"]),
            "geo_lat": float(raw["geo_lat"]),
            "geo_lon": float(raw["geo_lon"]),
            "resource_accessed": str(raw["resource_accessed"]),
            "action": str(raw["action"]),
            "auth_method": str(raw["auth_method"]),
            "session_duration_s": int(raw["session_duration_s"]),
            "bytes_transferred": int(raw["bytes_transferred"]),
            "success": bool(raw["success"]),
            "risk_score": int(risk),
            "attack_type": pred_class,
            "confidence": float(confidence),
            "anomaly_score": float(anomaly_score),
            "reason": reason,
            "baseline_type": baseline_type,
            "cold_start": int(feat_row.get("cold_start", 0)),
            "status": "open",
            "true_label": str(raw["label"]),
            "role": str(raw.get("role", "standard")),
            "created_at": now_ts,
        }
        alerts_to_insert.append(alert)
        n_flagged += 1

        if len(alerts_to_insert) >= batch_size:
            bulk_insert_alerts(alerts_to_insert)
            alerts_to_insert = []

    if alerts_to_insert:
        bulk_insert_alerts(alerts_to_insert)

    counts = get_alert_counts()
    print(f"\nDone! Database populated in vectorized mode:", flush=True)
    print(f"  Total alerts in DB: {counts['total']:,}", flush=True)
    print(f"  Open alerts:        {counts['open']:,}", flush=True)
    print(f"  Total events checked: {len(df):,}", flush=True)
    print(f"  Flagged as alerts:    {n_flagged:,}", flush=True)


if __name__ == "__main__":
    score_and_populate()
