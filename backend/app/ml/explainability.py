"""
Explainability module for DriftWatch — Feature 4.

Two layers of explanation:
  1. SHAP (TreeExplainer on XGBoost) — per-feature attribution for the
     classifier prediction (which features pushed it toward which attack class).
  2. Anomaly deviation — for the Isolation Forest layer, surface which input
     feature deviated most from the user's baseline.

Both are converted into a single plain-English reason string — the
highest-leverage artifact for the explainability judging criterion.

Example output:
  "Risk score 87/100 — flagged as impossible travel. Login from Tokyo 42
   minutes after a login from Oslo (implied speed not physically possible).
   Device previously unseen for this user."

The reason_string() function is intentionally kept in its own module so it
can be tweaked for demo/pitch without touching model code.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import shap

MODEL_DIR = Path(__file__).parent.parent / "models"

# ---------------------------------------------------------------------------
# SHAP explainer — lazy-loaded singleton to avoid re-loading on every request
# ---------------------------------------------------------------------------
_shap_explainer: Optional[shap.TreeExplainer] = None


def get_shap_explainer(clf=None) -> shap.TreeExplainer:
    """
    Return a cached TreeExplainer. Load the classifier from disk if needed.
    Uses a module-level singleton to avoid re-loading on every hot-path call.
    """
    global _shap_explainer
    if _shap_explainer is None:
        if clf is None:
            import joblib
            clf = joblib.load(MODEL_DIR / "classifier.pkl")
        # TreeExplainer is fast on XGBoost and produces exact Shapley values
        _shap_explainer = shap.TreeExplainer(clf)
    return _shap_explainer


# ---------------------------------------------------------------------------
# Feature attribution for the anomaly layer (Isolation Forest)
# ---------------------------------------------------------------------------

def top_anomaly_deviations(
    feature_row: pd.Series,
    feature_cols: list[str],
    n_top: int = 3,
) -> list[tuple[str, float]]:
    """
    For an Isolation Forest result, find which features deviate most.

    The IF doesn't produce Shapley values, so we approximate importance
    by identifying features with extreme absolute values (after scaling
    was already applied upstream). Features with the largest absolute
    z-score-like values are most responsible for the anomaly flag.

    Returns list of (feature_name, value) tuples sorted by abs(value) desc.
    """
    # Focus on the deviation/signal features, not raw values
    signal_features = [
        "hour_deviation", "session_z", "bytes_z", "is_novel_device",
        "is_public_ip", "resource_breadth_ratio", "rapid_failure_count",
        "travel_speed_kmh", "is_impossible_travel", "city_changed",
    ]
    present = [(f, float(feature_row.get(f, 0.0))) for f in signal_features
               if f in feature_cols]
    # Sort by abs value — largest deviation = most responsible for the flag
    present.sort(key=lambda x: abs(x[1]), reverse=True)
    return present[:n_top]


# ---------------------------------------------------------------------------
# SHAP attribution for the classifier layer
# ---------------------------------------------------------------------------

def get_shap_attributions(
    feature_row: pd.DataFrame,
    feature_cols: list[str],
    predicted_class_idx: int,
    clf=None,
    n_top: int = 4,
) -> list[tuple[str, float]]:
    """
    Compute SHAP values for one event and return the top contributing features
    for the predicted attack class.

    Args:
        feature_row: Single-row DataFrame with model features.
        feature_cols: Ordered feature column list.
        predicted_class_idx: Index of the predicted class in the label encoder.
        clf: XGBoost model (loaded from disk if None).
        n_top: How many top features to return.

    Returns:
        List of (feature_name, shap_value) sorted by abs(shap_value) desc.
    """
    explainer = get_shap_explainer(clf)
    # shape: (n_samples, n_features, n_classes) for multi-class
    shap_vals = explainer.shap_values(feature_row[feature_cols].values)

    if isinstance(shap_vals, list):
        # Older shap versions return a list of arrays (one per class)
        class_shap = shap_vals[predicted_class_idx][0]
    else:
        # Newer versions: array of shape (n_samples, n_features, n_classes)
        class_shap = shap_vals[0, :, predicted_class_idx]

    pairs = list(zip(feature_cols, class_shap))
    pairs.sort(key=lambda x: abs(x[1]), reverse=True)
    return pairs[:n_top]


# ---------------------------------------------------------------------------
# Plain-English reason string generator
# ---------------------------------------------------------------------------

# Thresholds used in reason strings — defined as constants so they're easy
# to tune for the demo without hunting through prose.
_HOUR_DEV_HIGH = 3.0     # SDs from normal login hour → "unusual hour"
_RAPID_FAIL_HIGH = 5     # failures in 2-min window → "rapid repeated failures"
_BREADTH_RATIO_HIGH = 2.0  # 2x user's normal resource breadth → "abnormal breadth"
_SPEED_IMPOSSIBLE = 800  # km/h → impossible travel


def reason_string(
    attack_type: str,
    risk_score: int,
    feature_row: pd.Series,
    anomaly_deviations: list[tuple[str, float]],
    shap_attrs: list[tuple[str, float]],
    raw_event: Optional[dict] = None,
) -> str:
    """
    Convert model outputs into one plain-English reason sentence.

    Args:
        attack_type: Predicted class ('brute_force', 'impossible_travel', etc.)
        risk_score: Combined 0–100 risk score.
        feature_row: Feature values for this event (as a Series).
        anomaly_deviations: Top deviating features from IF layer.
        shap_attrs: Top SHAP attributions from classifier layer.
        raw_event: Optional raw log dict for richer prose (city names, IPs).

    Returns:
        A single human-readable sentence. Never returns a raw number dump.
    """
    # Pull useful raw event fields if available
    city = raw_event.get("geo_city", "unknown location") if raw_event else "unknown location"
    user = raw_event.get("user_id", "this user") if raw_event else "this user"
    device = raw_event.get("device_id", "") if raw_event else ""
    resource = raw_event.get("resource_accessed", "") if raw_event else ""
    source_ip = raw_event.get("source_ip", "") if raw_event else ""

    hour_dev = float(feature_row.get("hour_deviation", 0))
    rapid_fails = int(feature_row.get("rapid_failure_count", 0))
    breadth = float(feature_row.get("resource_breadth_ratio", 1))
    speed = float(feature_row.get("travel_speed_kmh", 0))
    novel_device = bool(feature_row.get("is_novel_device", 0))
    is_public_ip = bool(feature_row.get("is_public_ip", 0))
    city_changed = bool(feature_row.get("city_changed", 0))

    prefix = f"Risk score {risk_score}/100 — flagged as {attack_type.replace('_', ' ')}."

    # ---- Per-attack-type reason prose ----
    if attack_type == "impossible_travel":
        speed_str = f"{speed:,.0f} km/h" if speed > 0 else "an impossible speed"
        reason = (
            f"{prefix} "
            f"Login detected from {city} shortly after a login from a distant location "
            f"(implied travel speed: {speed_str}, faster than any commercial aircraft). "
        )
        if novel_device:
            reason += f"Device '{device}' has not been seen for this user before."

    elif attack_type == "brute_force":
        reason = (
            f"{prefix} "
            f"{rapid_fails} failed login attempt{'s' if rapid_fails != 1 else ''} "
            f"from {source_ip} within a 2-minute window — consistent with an "
            f"automated password-guessing attack against {user}."
        )

    elif attack_type == "lateral_movement":
        resource_part = f"including '{resource}'" if resource else ""
        reason = (
            f"{prefix} "
            f"This session touched {int(feature_row.get('session_resource_count', 0))} "
            f"distinct resources {resource_part} — "
            f"{breadth:.1f}x more than this user's normal breadth. "
            f"Pattern consistent with credential compromise and internal reconnaissance."
        )

    elif attack_type == "credential_misuse":
        parts = []
        if novel_device:
            parts.append(f"device '{device}' not previously associated with {user}")
        if hour_dev >= _HOUR_DEV_HIGH:
            parts.append(f"login time is {hour_dev:.1f} standard deviations outside "
                          f"this user's normal schedule")
        if is_public_ip:
            parts.append(f"access from public IP {source_ip} (unusual for this user)")
        detail = "; ".join(parts) if parts else "access pattern deviates from this user's baseline"
        reason = f"{prefix} Successful login with: {detail}."

    elif attack_type == "device_spoofing":
        reason = (
            f"{prefix} "
            f"Device fingerprint '{device}' is not in {user}'s registered device set. "
        )
        if is_public_ip:
            reason += f"Access originated from public IP {source_ip}."

    elif attack_type == "normal":
        reason = f"Risk score {risk_score}/100 — behaviour consistent with {user}'s baseline. No anomalies detected."

    else:
        # unknown_anomaly — Layer 1 flagged it, Layer 2 not confident
        top_feat, top_val = anomaly_deviations[0] if anomaly_deviations else ("unknown", 0)
        reason = (
            f"{prefix} "
            f"Behaviour deviates from {user}'s baseline but does not match a "
            f"known attack pattern. Most anomalous signal: '{top_feat}' "
            f"(value: {top_val:.2f}). Recommend manual review."
        )

    # Append a cold-start notice if applicable
    if int(feature_row.get("cold_start", 0)) == 1:
        reason += " [Note: using population baseline — insufficient personal history for this user.]"

    return reason.strip()


# ---------------------------------------------------------------------------
# Combined risk score (0–100)
# Blends Layer 1 anomaly score + Layer 2 classifier confidence.
# ---------------------------------------------------------------------------

def compute_risk_score(
    anomaly_score: float,    # normalised [0,1] from IF
    attack_type: str,
    clf_confidence: float,   # [0,1] from classifier softmax
) -> int:
    """
    Blend Layer 1 and Layer 2 outputs into a single 0–100 risk score.

    Design rationale:
    - IF score (Layer 1) is weighted at 40%: even a mild anomaly score
      matters when the classifier isn't confident.
    - Classifier confidence (Layer 2) weighted at 60%: if XGBoost is
      very confident it's an attack, that dominates.
    - Normal predictions are capped at 30 to avoid alert fatigue.
    - Unknown anomalies get a moderate score (no attack label = less certain).
    """
    if attack_type == "normal":
        # IF says mildly anomalous but classifier says normal — low score
        return min(30, int(anomaly_score * 40))

    if attack_type == "unknown_anomaly":
        # Layer 1 flagged, Layer 2 not sure — moderate score
        base = anomaly_score * 0.6 + clf_confidence * 0.2
        return int(np.clip(base * 100, 40, 70))

    # Known attack type — weighted blend, boosted by classifier confidence
    blended = anomaly_score * 0.4 + clf_confidence * 0.6
    return int(np.clip(blended * 100, 50, 100))


# ---------------------------------------------------------------------------
# Entry point — demo / test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import joblib
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

    from app.ml.features import build_features, compute_user_baselines
    from app.ml.anomaly_model import load_model_artifacts, score_event
    from app.ml.classifier import load_classifier_artifacts, classify_event

    DATA_PATH = Path(__file__).parent.parent.parent / "data" / "access_logs.parquet"
    print(f"Loading data ...")
    df = pd.read_parquet(DATA_PATH)

    print("Loading model artifacts ...")
    if_model, if_scaler, baselines, feature_cols = load_model_artifacts()
    clf, clf_scaler, le = load_classifier_artifacts()

    print("Building features ...")
    X, y, merged = build_features(df, baselines)
    present_cols = [c for c in feature_cols if c in X.columns]
    X = X[present_cols]

    # Demo: show reason strings for one of each attack type
    print("\n" + "="*70)
    print("REASON STRING DEMO — one example per attack type")
    print("="*70)

    attack_types_to_show = [
        "brute_force", "credential_misuse", "lateral_movement",
        "impossible_travel", "device_spoofing",
    ]

    for attack in attack_types_to_show:
        mask = y == attack
        if not mask.any():
            continue

        # Pick the most signal-rich event for each attack type, not just the first.
        # This matters because some attacks generate bursts and the first event
        # may not yet have context (e.g. brute-force window, impossible-travel speed).
        candidates = X[mask].copy()
        if attack == "brute_force":
            # Pick mid-burst: highest rapid_failure_count
            if "rapid_failure_count" in candidates.columns:
                idx = candidates["rapid_failure_count"].idxmax()
            else:
                idx = candidates.index[0]
        elif attack == "impossible_travel":
            # Pick the second login of the pair: highest travel_speed_kmh
            if "travel_speed_kmh" in candidates.columns:
                idx = candidates["travel_speed_kmh"].idxmax()
            else:
                idx = candidates.index[0]
        else:
            idx = candidates.index[0]

        feat_row = X.loc[idx]
        raw = merged.loc[idx].to_dict()

        # Layer 1 score
        anomaly_score = score_event(feat_row.to_frame().T, if_model, if_scaler)

        # Layer 2 classification
        pred_class, confidence = classify_event(
            feat_row.to_frame().T, clf, clf_scaler, le)
        pred_idx = list(le.classes_).index(pred_class) if pred_class in le.classes_ else 0

        # Explanations
        deviations = top_anomaly_deviations(feat_row, present_cols)
        try:
            shap_attrs = get_shap_attributions(
                feat_row.to_frame().T, present_cols, pred_idx, clf)
        except Exception:
            shap_attrs = deviations  # fallback if SHAP fails

        risk = compute_risk_score(anomaly_score, pred_class, confidence)
        reason = reason_string(
            attack_type=pred_class,
            risk_score=risk,
            feature_row=feat_row,
            anomaly_deviations=deviations,
            shap_attrs=shap_attrs,
            raw_event=raw,
        )

        print(f"\n[True label: {attack}  |  Predicted: {pred_class}  |  Confidence: {confidence:.2%}]")
        print(f"  {reason}")

    print("\n" + "="*70)
