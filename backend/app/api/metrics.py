"""GET /metrics — model performance and system health metrics."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

from app.db import get_alert_counts
from app.ml.drift import load_drift_status
from app.schemas.alert import MetricsResponse, PerClassMetrics

router = APIRouter()
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics():
    # Load persisted model metrics
    with open(MODEL_DIR / "anomaly_metrics.json") as f:
        anomaly = json.load(f)
    with open(MODEL_DIR / "clf_metrics.json") as f:
        clf = json.load(f)

    drift = load_drift_status()
    counts = get_alert_counts()

    per_class = {
        cls: PerClassMetrics(**m)
        for cls, m in clf["per_class"].items()
    }

    return MetricsResponse(
        anomaly_roc_auc=anomaly["roc_auc"],
        anomaly_pr_auc=anomaly["pr_auc"],
        anomaly_fpr=anomaly["fpr"],
        classifier_metrics=per_class,
        total_alerts=counts["total"],
        open_alerts=counts["open"],
        confirmed_alerts=counts["confirmed"],
        dismissed_alerts=counts["dismissed"],
        drift_detected=bool(drift.get("global_drift_detected", False)),
        drift_users_affected=int(drift.get("users_drifted", 0)),
        drift_checked_at=drift.get("checked_at"),
        cold_start_users=0,  # populated from baselines on startup
    )
