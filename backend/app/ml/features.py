"""
Feature engineering for DriftWatch.

Transforms raw access-log rows into numerical features suitable for both
the unsupervised anomaly layer (Isolation Forest) and the supervised
classifier (XGBoost).

Design principle: features should capture *deviation from a user's own
baseline*, not just raw values. A login at 3 AM means nothing without
knowing that this user always logs in at 3 AM (or never does).

Two feature sets are produced:
  - `build_features(df)` — full feature matrix for training
  - `build_features_for_event(event, user_stats)` — single-event scoring
    used at inference time (hot path)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder


# ---------------------------------------------------------------------------
# Per-user baseline statistics
# ---------------------------------------------------------------------------

def compute_user_baselines(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute per-user behavioral baselines from the training set.

    Returns a DataFrame indexed by user_id with stats columns used later
    to compute deviation features. Only 'normal' rows should be passed in
    for training so attack events don't corrupt the baseline.

    Args:
        df: DataFrame containing (at minimum) normal access-log rows.

    Returns:
        DataFrame with one row per user_id, containing baseline statistics.
    """
    # Work on normal events only — attacks must not skew the learned baseline
    normal = df[df["label"] == "normal"].copy()
    normal["hour"] = pd.to_datetime(normal["timestamp"]).dt.hour

    grp = normal.groupby("user_id")

    baselines = pd.DataFrame({
        "mean_hour":            grp["hour"].mean(),
        "std_hour":             grp["hour"].std().fillna(1.0),
        "mean_session_s":       grp["session_duration_s"].mean(),
        "std_session_s":        grp["session_duration_s"].std().fillna(1.0),
        "mean_bytes":           grp["bytes_transferred"].mean(),
        "std_bytes":            grp["bytes_transferred"].std().fillna(1.0),
        "failure_rate":         grp["success"].apply(lambda x: (~x).mean()),
        # Number of distinct resources this user typically touches
        "n_distinct_resources": grp["resource_accessed"].nunique(),
        # Number of distinct devices this user has used
        "n_devices":            grp["device_id"].nunique(),
        # Set of known devices (used to detect novel device at inference)
        "known_devices":        grp["device_id"].apply(set),
        # Set of known source IPs
        "known_ips":            grp["source_ip"].apply(set),
        # Home city (most frequent)
        "home_city":            grp["geo_city"].agg(lambda x: x.mode()[0]),
        # Event count — used to decide cold-start vs personal baseline
        "event_count":          grp.size(),
    })

    return baselines


# ---------------------------------------------------------------------------
# Feature extraction — single event relative to user baseline
# ---------------------------------------------------------------------------

def _hour_deviation(hour: float, mean_hour: float, std_hour: float) -> float:
    """
    Circular deviation of login hour from user's typical hour.
    Uses circular distance so 23:00 and 01:00 are close, not 22 hours apart.
    """
    diff = abs(hour - mean_hour) % 24
    circular_diff = min(diff, 24 - diff)
    # Normalise by std so the unit is 'standard deviations from normal'
    return circular_diff / max(std_hour, 0.5)


def extract_features_for_row(
    row: pd.Series,
    baselines: pd.DataFrame,
    # Session-window aggregates computed from recent events — passed in from
    # the feature builder so we don't recompute per row
    session_resource_count: int = 1,
    session_ip_count: int = 1,
    recent_failure_count: int = 0,
    time_since_last_login_s: Optional[float] = None,
    prev_geo_city: Optional[str] = None,
    prev_geo_lat: Optional[float] = None,
    prev_geo_lon: Optional[float] = None,
    prev_timestamp: Optional[pd.Timestamp] = None,
) -> dict:
    """
    Convert one log row into a flat feature dict using per-user baselines.

    Returns a dict with only numeric/boolean values — no strings.
    String categoricals are one-hot encoded downstream in build_features().
    """
    uid = row["user_id"]
    hour = pd.to_datetime(row["timestamp"]).hour

    # ---- Baseline lookup (fall back to population median if user unknown) ----
    if uid in baselines.index:
        b = baselines.loc[uid]
        cold_start = int(b["event_count"] < 20)  # flag for dashboard display
    else:
        # Cold-start: user has no history — use population medians
        b = baselines.median(numeric_only=True)
        cold_start = 1

    # ---- Time-of-day deviation ----
    hour_dev = _hour_deviation(hour, b["mean_hour"], b["std_hour"])

    # ---- Session length deviation ----
    session_z = (row["session_duration_s"] - b["mean_session_s"]) / max(
        b["std_session_s"], 1.0)

    # ---- Bytes deviation ----
    bytes_z = (row["bytes_transferred"] - b["mean_bytes"]) / max(
        b["std_bytes"], 1.0)

    # known_devices is a set column dropped on Parquet save (not serialisable).
    # When loaded from disk it won't exist — fall back to empty set, which
    # means every device will look "novel" (conservative / safe default).
    if "known_devices" in baselines.columns and uid in baselines.index:
        known_devs = baselines.loc[uid, "known_devices"]
        if not isinstance(known_devs, set):
            known_devs = set()
    else:
        known_devs = set()
    is_novel_device = int(row["device_id"] not in known_devs)

    # ---- Novel IP flag (public vs private) ----
    # Private IPs (RFC1918) are typical for internal access;
    # a public IP from a known range is less suspicious than a novel private one
    ip = row["source_ip"]
    is_public_ip = int(
        not (ip.startswith("10.") or ip.startswith("192.168.") or
             ip.startswith("172."))
    )

    # ---- Resource breadth (lateral movement signal) ----
    # How many resources touched in this session vs. user's typical breadth
    resource_breadth_ratio = session_resource_count / max(
        b["n_distinct_resources"], 1)

    # ---- Rapid failure count (brute-force signal) ----
    # Number of failures seen in the recent window for this user/IP
    rapid_failure_count = recent_failure_count

    # ---- Impossible travel features ----
    travel_speed_kmh = 0.0
    is_impossible_travel = 0
    if (prev_geo_lat is not None and prev_geo_lon is not None
            and prev_timestamp is not None):
        dist_km = _haversine_km(
            prev_geo_lat, prev_geo_lon,
            float(row["geo_lat"]), float(row["geo_lon"]))
        hours_elapsed = max(
            (pd.to_datetime(row["timestamp"]) - prev_timestamp
             ).total_seconds() / 3600, 1e-6)
        travel_speed_kmh = dist_km / hours_elapsed
        # >800 km/h implies travel faster than a commercial aircraft
        is_impossible_travel = int(travel_speed_kmh > 800)

    # ---- City change flag ----
    city_changed = int(prev_geo_city is not None
                       and prev_geo_city != row["geo_city"])

    features = {
        # --- Time features ---
        "hour_of_day":          hour,
        "hour_deviation":       hour_dev,          # SDs from user's norm
        # --- Session features (deviation scores, not raw values) ---
        "session_z":            float(np.clip(session_z, -5, 5)),
        "bytes_z":              float(np.clip(bytes_z, -5, 5)),
        # --- Device / network features ---
        "is_novel_device":      is_novel_device,
        "is_public_ip":         is_public_ip,
        "n_known_devices":      int(b["n_devices"]),
        # --- Lateral movement features ---
        "resource_breadth_ratio": float(resource_breadth_ratio),
        "session_resource_count": session_resource_count,
        # --- Brute-force features ---
        "rapid_failure_count":  rapid_failure_count,
        # --- Impossible travel features ---
        "travel_speed_kmh":     float(np.clip(travel_speed_kmh, 0, 20000)),
        "is_impossible_travel": is_impossible_travel,
        "city_changed":         city_changed,
        # --- Cold-start flag (surfaced in dashboard) ---
        "cold_start":           cold_start,
    }

    return features


def _haversine_km(lat1: float, lon1: float,
                   lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


# ---------------------------------------------------------------------------
# Batch feature builder — used for training
# ---------------------------------------------------------------------------

def build_features(
    df: pd.DataFrame,
    baselines: Optional[pd.DataFrame] = None,
) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """
    Build the full feature matrix from a raw log DataFrame.

    Computes session-window aggregates (brute-force, lateral movement,
    impossible travel) by sorting and grouping events per user, then
    calls extract_features_for_row() on each row.

    Args:
        df: Raw log DataFrame (sorted by timestamp).
        baselines: Pre-computed user baselines. If None, computed from
                   normal events in `df` (training mode).

    Returns:
        (X, y, df_with_features)
          X  — feature DataFrame (numeric only)
          y  — label Series ('normal', 'brute_force', etc.)
          df — original df with feature columns appended (for inspection)
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values(["user_id", "timestamp"]).reset_index(drop=True)

    if baselines is None:
        baselines = compute_user_baselines(df)

    # ---- Action encoding ----
    action_map = {"login": 0, "read": 1, "write": 2, "escalate": 3}
    df["action_enc"] = df["action"].map(action_map).fillna(0).astype(int)

    auth_map = {"password": 0, "mfa": 1, "sso": 2, "certificate": 3, "api-key": 4}
    df["auth_enc"] = df["auth_method"].map(auth_map).fillna(0).astype(int)

    # ---- Compute per-user session window aggregates ----
    # For each event, look back at the last 30 events for the same user
    # to compute: session resource breadth, rapid failure count, travel info.
    feature_rows: list[dict] = []

    for uid, user_df in df.groupby("user_id", sort=False):
        user_df = user_df.sort_values("timestamp").reset_index(drop=True)

        prev_city: Optional[str] = None
        prev_lat: Optional[float] = None
        prev_lon: Optional[float] = None
        prev_ts: Optional[pd.Timestamp] = None

        for idx, row in user_df.iterrows():
            # Sliding window: last 30 events for this user (before this event)
            window = user_df[user_df["timestamp"] < row["timestamp"]].tail(30)

            # Resource breadth in this approximate session (last 30 events)
            session_resources = len(window["resource_accessed"].unique()) + 1

            # Rapid failures: failures in the last 2 minutes from same IP
            if len(window) > 0:
                two_min_ago = row["timestamp"] - pd.Timedelta(minutes=2)
                recent = window[
                    (window["timestamp"] >= two_min_ago) &
                    (window["source_ip"] == row["source_ip"]) &
                    (~window["success"])
                ]
                rapid_failures = len(recent)
            else:
                rapid_failures = 0

            feats = extract_features_for_row(
                row=row,
                baselines=baselines,
                session_resource_count=session_resources,
                session_ip_count=1,
                recent_failure_count=rapid_failures,
                prev_geo_city=prev_city,
                prev_geo_lat=prev_lat,
                prev_geo_lon=prev_lon,
                prev_timestamp=prev_ts,
            )
            # Include action and auth encoding
            feats["action_enc"] = int(action_map.get(row["action"], 0))
            feats["auth_enc"] = int(auth_map.get(row["auth_method"], 0))
            feats["event_id"] = row["event_id"]

            feature_rows.append(feats)

            # Update previous event state for travel detection
            prev_city = row["geo_city"]
            prev_lat = float(row["geo_lat"])
            prev_lon = float(row["geo_lon"])
            prev_ts = row["timestamp"]

    feat_df = pd.DataFrame(feature_rows)

    # Columns that come from both df and feat_df — drop the dupes from feat_df
    # so the merge on event_id doesn't produce _x/_y suffixed columns.
    # Raw values (session_duration_s, bytes_transferred, success) are already
    # in df; we keep only the *derived* feature columns in feat_df.
    raw_cols_in_df = set(df.columns)
    feat_only_cols = [c for c in feat_df.columns
                      if c == "event_id" or c not in raw_cols_in_df]
    feat_df = feat_df[feat_only_cols]

    # Merge back with original df to recover labels and event_ids
    merged = df.merge(feat_df, on="event_id", how="left")

    # Build final feature column list — derived features + selected raw cols
    raw_feature_cols = ["session_duration_s", "bytes_transferred", "success",
                        "action_enc", "auth_enc"]
    derived_cols = [c for c in feat_df.columns if c != "event_id"]
    feature_cols = derived_cols + [c for c in raw_feature_cols
                                    if c in merged.columns]

    X = merged[feature_cols].fillna(0)
    y = merged["label"]

    return X, y, merged


# ---------------------------------------------------------------------------
# Save / load baselines
# ---------------------------------------------------------------------------

def save_baselines(baselines: pd.DataFrame, path: Path) -> None:
    """Persist baselines; skip set columns (not Parquet-serialisable)."""
    # Drop set-typed columns before saving — they're rebuilt from raw data
    save_cols = [c for c in baselines.columns
                 if c not in ("known_devices", "known_ips")]
    baselines[save_cols].to_parquet(path)


def load_baselines(path: Path) -> pd.DataFrame:
    return pd.read_parquet(path)


# ---------------------------------------------------------------------------
# Entry point — quick sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    data_path = Path(__file__).parent.parent.parent / "data" / "access_logs.parquet"
    print(f"Loading {data_path} ...")
    df = pd.read_parquet(data_path)

    print("Computing baselines ...")
    baselines = compute_user_baselines(df)
    print(f"Baselines shape: {baselines.shape}")
    print(baselines[["mean_hour", "std_hour", "mean_session_s",
                      "n_distinct_resources", "event_count"]].head())

    print("\nBuilding features (this may take ~30s for 20k events) ...")
    X, y, merged = build_features(df, baselines)
    print(f"Feature matrix shape: {X.shape}")
    print(f"Feature columns: {list(X.columns)}")
    print(f"\nLabel distribution:\n{y.value_counts()}")
    print(f"\nSample features (first 3 attack rows):")
    attack_mask = y != "normal"
    print(X[attack_mask].head(3).to_string())
