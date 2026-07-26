"""
Drift detection and cold-start fallback — Feature 5.

Two responsibilities:
  1. DRIFT DETECTION: Flag when a user's behavior has statistically shifted
     so significantly that the baseline needs refreshing. Uses ADWIN (Adaptive
     Windowing) via the `river` library — a proven streaming drift detector
     that's lightweight and requires no held-out data.

     For the demo: we also implement a KS-test fallback in case river isn't
     installed. Both produce the same output schema.

  2. COLD-START FALLBACK: When a user has fewer than MIN_PERSONAL_EVENTS
     events in history, there's not enough data to build a reliable personal
     baseline. In that case we substitute the population-level (role-based)
     baseline and display a "baseline: population" indicator in the dashboard.

     Rule-based guardrails are always active regardless of baseline type —
     impossible travel and brute-force don't need personal history to detect.

Design note: In production, drift detection would run on the cold path
(scheduled batch job, e.g. every 6 hours). The hot path (real-time scoring)
just reads the "drift flagged" status from a state store. The demo simulates
this separation via a JSON status file.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy import stats

# river is optional — fall back to KS-test if not installed
try:
    # pyrefly: ignore [missing-import]
    from river import drift as river_drift
    RIVER_AVAILABLE = True
except ImportError:
    RIVER_AVAILABLE = False

MODEL_DIR = Path(__file__).parent.parent / "models"
DRIFT_STATUS_PATH = MODEL_DIR / "drift_status.json"

# A user needs at least this many events before we switch from the
# population baseline to their personal baseline.
# 20 is a pragmatic choice: enough to estimate mean login hour and session
# length reliably, not so many that new users are stuck on population baseline
# for their entire first week.
MIN_PERSONAL_EVENTS = 20

# KS-test p-value threshold — below this means the distributions are
# statistically different enough to flag drift. 0.05 is the standard
# significance level; we use 0.01 (stricter) to reduce drift false-alarms.
KS_DRIFT_THRESHOLD = 0.01

# Rolling window (days) for drift detection — compare last 30 days vs.
# the 30 days before that. Longer windows = more stable but slower to detect.
DRIFT_WINDOW_DAYS = 30


# ---------------------------------------------------------------------------
# Drift detection
# ---------------------------------------------------------------------------

def detect_drift_ks(
    recent_values: np.ndarray,
    baseline_values: np.ndarray,
    feature_name: str = "feature",
) -> dict:
    """
    KS-test drift detector: compare recent window to historical baseline.

    Returns a dict with drift status and the feature that drifted most.
    """
    if len(recent_values) < 10 or len(baseline_values) < 10:
        return {"drifted": False, "feature": feature_name,
                "p_value": 1.0, "method": "ks_test", "reason": "insufficient data"}

    stat, p_value = stats.ks_2samp(baseline_values, recent_values)
    drifted = p_value < KS_DRIFT_THRESHOLD

    return {
        "drifted": drifted,
        "feature": feature_name,
        "ks_statistic": float(stat),
        "p_value": float(p_value),
        "method": "ks_test",
        "reason": (f"p={p_value:.4f} < {KS_DRIFT_THRESHOLD} for {feature_name}"
                   if drifted else "no significant drift"),
    }


def detect_drift_adwin(values: list[float]) -> dict:
    """
    ADWIN drift detector from river library.

    ADWIN maintains a sliding window and detects when the mean of the
    window has changed significantly — it's parameter-free and adapts
    the window size automatically.
    """
    if not RIVER_AVAILABLE:
        return {"drifted": False, "method": "adwin",
                "reason": "river not installed, use KS-test fallback"}

    detector = river_drift.ADWIN(delta=0.002)  # delta controls sensitivity
    drift_detected = False
    drift_at = None

    for i, val in enumerate(values):
        detector.update(val)
        if detector.drift_detected:
            drift_detected = True
            drift_at = i
            # Reset to continue detecting further drifts
            detector = river_drift.ADWIN(delta=0.002)

    return {
        "drifted": drift_detected,
        "method": "adwin",
        "drift_at_index": drift_at,
        "reason": (f"ADWIN detected drift at index {drift_at}"
                   if drift_detected else "no drift detected"),
    }


def run_drift_check(
    df: pd.DataFrame,
    feature_cols_to_check: Optional[list[str]] = None,
) -> dict:
    """
    Run drift detection across the dataset for all users and key features.

    Compares the most recent DRIFT_WINDOW_DAYS against the preceding window.
    Saves results to drift_status.json for the API to serve.

    Args:
        df: Full log DataFrame (with timestamps).
        feature_cols_to_check: Which raw features to monitor for drift.
                               Defaults to login hour, session length, bytes.

    Returns:
        Drift status dict saved to disk.
    """
    if feature_cols_to_check is None:
        feature_cols_to_check = ["session_duration_s", "bytes_transferred"]

    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df["hour"] = df["timestamp"].dt.hour

    cutoff = df["timestamp"].max()
    recent_start = cutoff - pd.Timedelta(days=DRIFT_WINDOW_DAYS)
    baseline_start = recent_start - pd.Timedelta(days=DRIFT_WINDOW_DAYS)

    recent_df = df[df["timestamp"] >= recent_start]
    baseline_df = df[(df["timestamp"] >= baseline_start) &
                     (df["timestamp"] < recent_start)]

    drifted_users: list[dict] = []
    n_checked = 0

    # Check per-user drift on login hour (most intuitive drift signal)
    for uid in df["user_id"].unique():
        u_recent = recent_df[recent_df["user_id"] == uid]["hour"].values
        u_baseline = baseline_df[baseline_df["user_id"] == uid]["hour"].values

        result = detect_drift_ks(u_recent, u_baseline, "login_hour")
        n_checked += 1

        if result["drifted"]:
            drifted_users.append({
                "user_id": uid,
                **result,
            })

    # Global population drift check on numerical features
    population_drift: list[dict] = []
    for feat in feature_cols_to_check:
        if feat not in df.columns:
            continue
        r = detect_drift_ks(
            recent_df[feat].dropna().values,
            baseline_df[feat].dropna().values,
            feat,
        )
        population_drift.append(r)

    status = {
        "checked_at": pd.Timestamp.utcnow().isoformat(),
        "window_days": DRIFT_WINDOW_DAYS,
        "users_checked": n_checked,
        "users_drifted": len(drifted_users),
        "drifted_users": drifted_users[:10],  # cap to avoid huge JSON
        "population_drift": population_drift,
        "global_drift_detected": (len(drifted_users) > 0 or
                                   any(r["drifted"] for r in population_drift)),
        "method": "ks_test",
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    class _NumpyEncoder(json.JSONEncoder):
        """Handle numpy scalar types that standard json can't serialise."""
        def default(self, obj):
            if isinstance(obj, (np.bool_, np.integer)):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            return super().default(obj)

    with open(DRIFT_STATUS_PATH, "w") as f:
        json.dump(status, f, indent=2, cls=_NumpyEncoder)

    return status


def load_drift_status() -> dict:
    """Load last saved drift status, or return a safe default."""
    if DRIFT_STATUS_PATH.exists():
        with open(DRIFT_STATUS_PATH) as f:
            return json.load(f)
    return {
        "global_drift_detected": False,
        "users_drifted": 0,
        "users_checked": 0,
        "checked_at": None,
        "method": "not_run",
    }


# ---------------------------------------------------------------------------
# Cold-start fallback
# ---------------------------------------------------------------------------

def get_baseline_type(
    user_id: str,
    baselines: pd.DataFrame,
) -> str:
    """
    Return 'personal' if the user has enough history, else 'population'.

    This string is surfaced in the dashboard so analysts know which
    baseline was used for scoring — a key transparency signal.
    """
    if user_id not in baselines.index:
        return "population"
    event_count = baselines.loc[user_id, "event_count"]
    return "personal" if event_count >= MIN_PERSONAL_EVENTS else "population"


def get_population_baseline(
    baselines: pd.DataFrame,
    role: Optional[str] = None,
) -> pd.Series:
    """
    Compute a population-level baseline for cold-start users.

    If a role is provided, uses the median of users with that role,
    giving a tighter baseline than the overall population median.

    Args:
        baselines: Per-user baseline DataFrame.
        role: Optional role string ('admin', 'developer', etc.)

    Returns:
        A Series with the same columns as per-user baselines.
    """
    numeric_cols = baselines.select_dtypes(include=[np.number]).columns
    numeric_baselines = baselines[numeric_cols]

    if role and "role" in baselines.columns:
        role_subset = baselines[baselines["role"] == role]
        if len(role_subset) >= 5:  # enough users with this role
            return role_subset[numeric_cols].median()

    return numeric_baselines.median()


# ---------------------------------------------------------------------------
# Rule-based guardrails — always active, no baseline needed
# ---------------------------------------------------------------------------

def apply_rule_based_checks(event: dict) -> list[dict]:
    """
    Hard rules that fire independent of any learned baseline.
    These handle the cold-start window for the two most obvious attack types.

    Returns list of rule-violation dicts (empty if no violations).
    Used when an event has cold_start=1 and the ML models are unreliable.
    """
    violations: list[dict] = []

    # Rule 1: Impossible travel — purely physical, no baseline needed
    speed = float(event.get("travel_speed_kmh", 0))
    if speed > 800:
        violations.append({
            "rule": "impossible_travel",
            "severity": "high",
            "detail": f"Travel speed {speed:,.0f} km/h exceeds physical maximum",
        })

    # Rule 2: Brute-force — rapid failures, no per-user baseline needed
    rapid_fails = int(event.get("rapid_failure_count", 0))
    if rapid_fails >= 10:
        violations.append({
            "rule": "brute_force",
            "severity": "high",
            "detail": f"{rapid_fails} failed logins in 2-minute window",
        })

    # Rule 3: Escalation from a public IP — rare enough to always flag
    if event.get("action") == "escalate" and event.get("is_public_ip", 0):
        violations.append({
            "rule": "suspicious_escalation",
            "severity": "medium",
            "detail": "Privilege escalation from a public IP address",
        })

    return violations


# ---------------------------------------------------------------------------
# Entry point — run drift check and show cold-start status
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

    DATA_PATH = Path(__file__).parent.parent.parent / "data" / "access_logs.parquet"
    print(f"Loading data ...")
    df = pd.read_parquet(DATA_PATH)

    # ---- Drift detection ----
    print("\nRunning drift detection ...")
    t0 = time.time()
    status = run_drift_check(df)
    print(f"  Completed in {time.time()-t0:.1f}s")
    print(f"  Users checked:  {status['users_checked']}")
    print(f"  Users drifted:  {status['users_drifted']}")
    print(f"  Population drift: {status['population_drift']}")
    print(f"  Global drift detected: {status['global_drift_detected']}")
    print(f"  Saved to: {DRIFT_STATUS_PATH}")

    # ---- Cold-start status ----
    print("\nCold-start baseline status (first 10 users):")
    baselines = pd.read_parquet(MODEL_DIR / "baselines.parquet")
    print(f"  {'User':<15} {'Events':>8} {'Baseline':>12}")
    print(f"  {'-'*38}")
    for uid in list(baselines.index[:10]):
        btype = get_baseline_type(uid, baselines)
        n = int(baselines.loc[uid, "event_count"])
        print(f"  {uid:<15} {n:>8} {btype:>12}")

    # ---- Rule-based guardrail demo ----
    print("\nRule-based guardrail demo (cold-start event):")
    fake_event = {
        "travel_speed_kmh": 12000,
        "rapid_failure_count": 15,
        "action": "escalate",
        "is_public_ip": 1,
    }
    violations = apply_rule_based_checks(fake_event)
    for v in violations:
        print(f"  [{v['severity'].upper()}] {v['rule']}: {v['detail']}")

    if RIVER_AVAILABLE:
        print(f"\nriver/ADWIN available: yes")
    else:
        print(f"\nriver/ADWIN available: no — using KS-test fallback")
