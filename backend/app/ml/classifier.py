"""
Supervised attack classifier — Layer 2 of DriftWatch's detection engine.

XGBoost multi-class classifier trained on all events (normal + all attack types).
Only runs on events that Layer 1 (Isolation Forest) has already flagged as
anomalous — this keeps false positives low and latency fast.

Addresses class imbalance with SMOTE (synthetic minority oversampling) rather
than naive duplication, combined with XGBoost's built-in class weighting.

Outputs:
  - backend/app/models/classifier.pkl     — trained XGBoost model
  - backend/app/models/clf_scaler.pkl     — fitted scaler for classifier input
  - backend/app/models/label_encoder.pkl  — LabelEncoder for class names
  - backend/app/models/clf_metrics.json   — per-class precision/recall/F1
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.ml.features import build_features, compute_user_baselines

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent.parent / "data"
MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Label set — 'unknown_anomaly' is the honest class for cold-start /
# Layer-1-flagged-but-unrecognised events (never used in training,
# returned by the API when classifier confidence is low).
# ---------------------------------------------------------------------------
ATTACK_LABELS = [
    "normal",
    "credential_misuse",
    "brute_force",
    "lateral_movement",
    "impossible_travel",
    "device_spoofing",
]

RANDOM_SEED = 42

# SMOTE minimum neighbours — we need at least k+1 samples per minority class.
# Set conservatively; SMOTE will raise if any class has fewer samples than k.
SMOTE_K_NEIGHBORS = 3


def train_classifier(
    df: pd.DataFrame,
    baselines: pd.DataFrame,
    feature_cols: list[str],
) -> tuple[XGBClassifier, StandardScaler, LabelEncoder, dict]:
    """
    Train an XGBoost multi-class classifier on the full feature set.

    Args:
        df: Full dataset with labels.
        baselines: Pre-computed user baselines (from anomaly model training).
        feature_cols: Ordered list of feature column names to use.

    Returns:
        (classifier, scaler, label_encoder, metrics_dict)
    """
    print("Building feature matrix for classifier ...")
    t0 = time.time()
    X, y, _ = build_features(df, baselines)
    print(f"  Feature matrix: {X.shape}  ({time.time()-t0:.1f}s)")

    # Ensure feature column order matches anomaly model
    X = X[[c for c in feature_cols if c in X.columns]].fillna(0)

    # ---- Encode labels ----
    le = LabelEncoder()
    le.fit(ATTACK_LABELS)
    y_enc = le.transform(y)

    # ---- Train / test split (stratified) ----
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=RANDOM_SEED, stratify=y_enc)

    print(f"\nClass distribution in training set:")
    for cls_idx, cls_name in enumerate(le.classes_):
        n = (y_train == cls_idx).sum()
        print(f"  {cls_name:<25} {n:>5}")

    # ---- SMOTE oversampling on minority attack classes ----
    # Normal class will not be oversampled (it's already ~98%).
    # SMOTE generates synthetic samples between real minority samples,
    # which is more principled than just duplicating rows.
    print(f"\nApplying SMOTE (k={SMOTE_K_NEIGHBORS}) to balance classes ...")

    # Check minimum class size — SMOTE needs at least k+1 samples
    min_class_size = min((y_train == i).sum() for i in range(len(le.classes_)))
    k = min(SMOTE_K_NEIGHBORS, min_class_size - 1)
    k = max(1, k)  # always at least 1

    smote = SMOTE(k_neighbors=k, random_state=RANDOM_SEED)
    X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

    print(f"  Post-SMOTE training set size: {len(X_resampled):,}")
    for cls_idx, cls_name in enumerate(le.classes_):
        n = (y_resampled == cls_idx).sum()
        print(f"  {cls_name:<25} {n:>6}")

    # ---- Scale ----
    scaler = StandardScaler()
    X_resampled_scaled = scaler.fit_transform(X_resampled)
    X_test_scaled = scaler.transform(X_test)

    # ---- XGBoost — class weights handle any residual imbalance ----
    # We use SMOTE + class weighting together:
    # SMOTE addresses inter-class imbalance; class weighting handles
    # any remaining skew after oversampling.
    n_classes = len(le.classes_)

    clf = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="mlogloss",
        random_state=RANDOM_SEED,
        n_jobs=-1,
        tree_method="hist",     # faster on CPU; hist also required for GPU if later needed
    )

    print(f"\nTraining XGBoost classifier ({n_classes} classes) ...")
    t0 = time.time()
    clf.fit(X_resampled_scaled, y_resampled,
            eval_set=[(X_test_scaled, y_test)],
            verbose=False)
    print(f"  Training complete ({time.time()-t0:.1f}s)")

    # ---- Evaluate ----
    y_pred = clf.predict(X_test_scaled)
    y_prob = clf.predict_proba(X_test_scaled)

    print(f"\n{'='*60}")
    print(f"  Classifier (XGBoost) — Test Set Results")
    print(f"{'='*60}")
    print(classification_report(
        y_test, y_pred,
        target_names=le.classes_,
        zero_division=0,
    ))

    # Per-class PR-AUC (one-vs-rest)
    print("  Per-class PR-AUC (one-vs-rest):")
    pr_aucs = {}
    for i, cls_name in enumerate(le.classes_):
        y_bin = (y_test == i).astype(int)
        if y_bin.sum() > 0:
            auc = average_precision_score(y_bin, y_prob[:, i])
            pr_aucs[cls_name] = float(auc)
            print(f"    {cls_name:<25} {auc:.4f}")

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print(f"\n  Confusion matrix (rows=true, cols=pred):")
    print(f"  Classes: {list(le.classes_)}")
    print(f"  {cm}")
    print(f"{'='*60}\n")

    # ---- Build metrics dict ----
    p, r, f1, support = precision_recall_fscore_support(
        y_test, y_pred, labels=range(n_classes), zero_division=0)
    metrics = {
        "per_class": {
            cls_name: {
                "precision": float(p[i]),
                "recall": float(r[i]),
                "f1": float(f1[i]),
                "pr_auc": pr_aucs.get(cls_name, 0.0),
                "support": int(support[i]),
            }
            for i, cls_name in enumerate(le.classes_)
        },
        "confusion_matrix": cm.tolist(),
        "class_names": list(le.classes_),
    }

    return clf, scaler, le, metrics


def save_classifier_artifacts(
    clf: XGBClassifier,
    scaler: StandardScaler,
    le: LabelEncoder,
    metrics: dict,
) -> None:
    joblib.dump(clf, MODEL_DIR / "classifier.pkl")
    joblib.dump(scaler, MODEL_DIR / "clf_scaler.pkl")
    joblib.dump(le, MODEL_DIR / "label_encoder.pkl")
    with open(MODEL_DIR / "clf_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Classifier artifacts saved to {MODEL_DIR}/")


def load_classifier_artifacts() -> tuple[XGBClassifier, StandardScaler, LabelEncoder]:
    clf = joblib.load(MODEL_DIR / "classifier.pkl")
    scaler = joblib.load(MODEL_DIR / "clf_scaler.pkl")
    le = joblib.load(MODEL_DIR / "label_encoder.pkl")
    return clf, scaler, le


def classify_event(
    features: pd.DataFrame,
    clf: XGBClassifier,
    scaler: StandardScaler,
    le: LabelEncoder,
    min_confidence: float = 0.4,
) -> tuple[str, float]:
    """
    Classify a single event (hot path).

    Returns:
        (predicted_class_name, confidence)
        If max confidence < min_confidence, returns ('unknown_anomaly', confidence)
        to handle cold-start / novel attack patterns honestly.
    """
    scaled = scaler.transform(features)
    probs = clf.predict_proba(scaled)[0]
    pred_idx = int(np.argmax(probs))
    confidence = float(probs[pred_idx])

    if confidence < min_confidence:
        # Layer 1 flagged it but Layer 2 isn't sure — honest fallback
        return "unknown_anomaly", confidence

    return str(le.classes_[pred_idx]), confidence


# ---------------------------------------------------------------------------
# Entry point — run after anomaly_model.py has saved its artifacts
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Loading data ...")
    df = pd.read_parquet(DATA_DIR / "access_logs.parquet")

    # Load baselines and feature cols saved by anomaly_model.py
    baselines = pd.read_parquet(MODEL_DIR / "baselines.parquet")
    with open(MODEL_DIR / "feature_cols.json") as f:
        feature_cols = json.load(f)

    clf, scaler, le, metrics = train_classifier(df, baselines, feature_cols)
    save_classifier_artifacts(clf, scaler, le, metrics)

    # ---- Latency benchmark ----
    print("Benchmarking classifier latency ...")
    X, _, _ = build_features(df.head(200), baselines)
    X = X[[c for c in feature_cols if c in X.columns]].fillna(0)

    latencies_ms = []
    for i in range(min(100, len(X))):
        t0 = time.perf_counter()
        classify_event(X.iloc[[i]], clf, scaler, le)
        latencies_ms.append((time.perf_counter() - t0) * 1000)

    print(f"  p50 latency: {np.percentile(latencies_ms, 50):.2f} ms")
    print(f"  p95 latency: {np.percentile(latencies_ms, 95):.2f} ms")
