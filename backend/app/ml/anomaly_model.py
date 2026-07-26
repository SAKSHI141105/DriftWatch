"""
Anomaly model training and scoring — Layer 1 of DriftWatch's detection engine.

Uses Isolation Forest (via pyod) trained ONLY on normal events.
This is what gives the system its ability to catch novel/unknown attacks:
it doesn't need a label to flag something it's never seen before.

The anomaly score from this layer feeds into the combined risk score and
also acts as the trigger that routes events to the Layer 2 classifier.

Outputs:
  - backend/app/models/isolation_forest.pkl  — trained IF model
  - backend/app/models/baselines.parquet     — per-user baselines
  - backend/app/models/feature_cols.json     — ordered feature column list
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
# pyrefly: ignore [missing-import]
from pyod.models.iforest import IForest
from sklearn.metrics import (
    average_precision_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Use the local ml package
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.ml.features import build_features, compute_user_baselines, save_baselines

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent.parent / "data"
MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Hyperparameters
# Isolation Forest contamination = expected anomaly rate.
# We know the true rate is ~2%, so we set this honestly rather than
# using 'auto' (which defaults to 0.1 and would flag 10x too many events).
# ---------------------------------------------------------------------------
IF_CONTAMINATION = 0.02      # matches our synthetic attack rate
IF_N_ESTIMATORS = 200        # more trees → more stable scores; still fast
IF_MAX_SAMPLES = "auto"      # sklearn default: min(256, n_samples)
RANDOM_SEED = 42


def train_anomaly_model(
    df: pd.DataFrame,
) -> tuple[IForest, StandardScaler, pd.DataFrame, list[str], dict]:
    """
    Train an Isolation Forest on normal events only.

    Args:
        df: Full dataset (normal + attack rows with labels).

    Returns:
        (model, scaler, baselines, feature_cols)
    """
    print("Computing per-user baselines from normal events ...")
    baselines = compute_user_baselines(df)
    print(f"  Baselines computed for {len(baselines)} users")

    print("\nBuilding feature matrix ...")
    t0 = time.time()
    X, y, _ = build_features(df, baselines)
    feature_cols = list(X.columns)
    print(f"  Feature matrix: {X.shape}  ({time.time()-t0:.1f}s)")

    # ---- Train/test split ----
    # Stratify on binary is_attack so both splits have ~2% attack rate
    y_binary = (y != "normal").astype(int)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_binary, test_size=0.2, random_state=RANDOM_SEED,
        stratify=y_binary)

    # ---- Isolation Forest trains on NORMAL events only ----
    # This is the unsupervised layer — it never sees attack labels.
    X_train_normal = X_train[y_train == 0]
    print(f"\nTraining Isolation Forest on {len(X_train_normal):,} normal events ...")

    # Scale features — IF is not sensitive to scale, but scaling helps
    # when we later combine the IF score with supervised classifier output.
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_normal)

    model = IForest(
        n_estimators=IF_N_ESTIMATORS,
        max_samples=IF_MAX_SAMPLES,
        contamination=IF_CONTAMINATION,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_train_scaled)
    print("  Training complete.")

    # ---- Evaluate on held-out test set ----
    print("\nEvaluating on held-out test set ...")
    X_test_scaled = scaler.transform(X_test)

    # pyod's decision_function returns higher = more anomalous (unlike sklearn)
    anomaly_scores = model.decision_function(X_test_scaled)

    roc_auc = roc_auc_score(y_test, anomaly_scores)
    pr_auc = average_precision_score(y_test, anomaly_scores)

    # Threshold at IF's own contamination boundary
    threshold = np.percentile(anomaly_scores, (1 - IF_CONTAMINATION) * 100)
    y_pred = (anomaly_scores >= threshold).astype(int)

    tp = ((y_pred == 1) & (y_test == 1)).sum()
    fp = ((y_pred == 1) & (y_test == 0)).sum()
    fn = ((y_pred == 0) & (y_test == 1)).sum()
    tn = ((y_pred == 0) & (y_test == 0)).sum()

    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    fpr = fp / max(fp + tn, 1)

    print(f"\n{'='*50}")
    print(f"  Anomaly Layer (Isolation Forest) — Test Set Results")
    print(f"{'='*50}")
    print(f"  ROC-AUC:          {roc_auc:.4f}")
    print(f"  PR-AUC:           {pr_auc:.4f}")
    print(f"  Precision:        {precision:.4f}")
    print(f"  Recall:           {recall:.4f}")
    print(f"  False-positive rate: {fpr:.4f}")
    print(f"  True positives:   {tp}")
    print(f"  False positives:  {fp}")
    print(f"  False negatives:  {fn}")
    print(f"{'='*50}\n")

    return model, scaler, baselines, feature_cols, {
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "precision": float(precision),
        "recall": float(recall),
        "fpr": float(fpr),
    }


def score_event(
    features: pd.DataFrame,
    model: IForest,
    scaler: StandardScaler,
) -> float:
    """
    Score a single event (or batch) through the anomaly model.

    Returns anomaly score in [0, 1] range (higher = more anomalous).
    Suitable for hot-path real-time inference.

    Args:
        features: DataFrame row(s) with the same columns used in training.
        model: Trained IForest model.
        scaler: Fitted StandardScaler.

    Returns:
        Anomaly score normalised to [0, 1].
    """
    scaled = scaler.transform(features)
    raw_score = model.decision_function(scaled)
    # Normalise to [0, 1] using sigmoid-like compression
    # Raw pyod scores are bounded but the range varies — clip then min-max scale
    clipped = np.clip(raw_score, -0.5, 0.5)
    normalised = (clipped + 0.5)  # shift to [0, 1]
    return float(normalised.mean())


def save_model_artifacts(
    model: IForest,
    scaler: StandardScaler,
    baselines: pd.DataFrame,
    feature_cols: list[str],
    metrics: dict,
) -> None:
    """Persist all model artifacts to MODEL_DIR."""
    joblib.dump(model, MODEL_DIR / "isolation_forest.pkl")
    joblib.dump(scaler, MODEL_DIR / "if_scaler.pkl")
    save_baselines(baselines, MODEL_DIR / "baselines.parquet")
    with open(MODEL_DIR / "feature_cols.json", "w") as f:
        json.dump(feature_cols, f, indent=2)
    with open(MODEL_DIR / "anomaly_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Model artifacts saved to {MODEL_DIR}/")


def load_model_artifacts() -> tuple[IForest, StandardScaler, pd.DataFrame, list[str]]:
    """Load trained artifacts from disk for inference."""
    model = joblib.load(MODEL_DIR / "isolation_forest.pkl")
    scaler = joblib.load(MODEL_DIR / "if_scaler.pkl")
    baselines = pd.read_parquet(MODEL_DIR / "baselines.parquet")
    with open(MODEL_DIR / "feature_cols.json") as f:
        feature_cols = json.load(f)
    return model, scaler, baselines, feature_cols


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Loading data from {DATA_DIR}/access_logs.parquet ...")
    df = pd.read_parquet(DATA_DIR / "access_logs.parquet")
    print(f"  Loaded {len(df):,} events")

    model, scaler, baselines, feature_cols, metrics = train_anomaly_model(df)
    save_model_artifacts(model, scaler, baselines, feature_cols, metrics)

    # ---- Latency benchmark ----
    # Score 100 individual events to prove real-time claim
    print("\nBenchmarking inference latency ...")
    _, _, merged = build_features(df.head(200), baselines)
    X_sample = merged[[c for c in feature_cols if c in merged.columns]].fillna(0)
    # Align columns exactly — drop any that went missing, keep order consistent
    present_cols = [c for c in feature_cols if c in X_sample.columns]
    X_sample = X_sample[present_cols]

    latencies_ms = []
    for i in range(min(100, len(X_sample))):
        t0 = time.perf_counter()
        score_event(X_sample.iloc[[i]], model, scaler)
        latencies_ms.append((time.perf_counter() - t0) * 1000)

    print(f"  p50 latency: {np.percentile(latencies_ms, 50):.2f} ms")
    print(f"  p95 latency: {np.percentile(latencies_ms, 95):.2f} ms")
    print(f"  p99 latency: {np.percentile(latencies_ms, 99):.2f} ms")
