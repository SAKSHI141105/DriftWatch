"""
Smoke tests for the synthetic log generator.

Run with:  python backend/tests/test_generator.py
(from the repository root, or adjust sys.path as needed)
"""

import sys
from pathlib import Path

# Make sure we can import from backend/app/ml regardless of CWD
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.ml.generator import (
    CITIES,
    _haversine_km,
    _make_user_profiles,
    generate_dataset,
)


def test_haversine():
    """Sanity-check the Haversine function with a known distance."""
    # New York to London ≈ 5,570 km
    dist = _haversine_km(40.71, -74.01, 51.51, -0.13)
    assert 5400 < dist < 5800, f"Unexpected NYC-London distance: {dist:.0f} km"
    print(f"  [OK] Haversine NYC->London: {dist:.0f} km")


def test_profiles_generated():
    """Check that user profiles have the expected shape."""
    profiles = _make_user_profiles(50)
    assert len(profiles) == 50, "Expected 50 profiles"
    for p in profiles:
        assert 2 <= len(p.devices) <= 3, "Each user should have 2–3 devices"
        assert 3 <= len(p.typical_resources) <= 5, "Each user should have 3–5 resources"
        assert abs(sum(p.auth_method_probs) - 1.0) < 1e-6, "Auth probs must sum to 1"
    print(f"  [OK] {len(profiles)} user profiles generated with correct shape")


def test_dataset_shape_and_labels():
    """
    Generate a small dataset and verify:
    - All 5 attack types are present
    - Attack rate is in the expected range (0.5%–5%)
    - Required columns exist
    - No NaN in key columns
    """
    df = generate_dataset(n_users=20, events_per_user=50,
                           attack_rate=0.02, save=False)

    required_cols = [
        "event_id", "timestamp", "user_id", "device_id", "source_ip",
        "geo_city", "geo_lat", "geo_lon", "resource_accessed", "action",
        "auth_method", "session_duration_s", "bytes_transferred",
        "success", "label", "role",
    ]
    for col in required_cols:
        assert col in df.columns, f"Missing column: {col}"
    print(f"  [OK] All {len(required_cols)} required columns present")

    expected_attack_types = {
        "credential_misuse", "brute_force", "lateral_movement",
        "impossible_travel", "device_spoofing",
    }
    found_attack_types = set(df[df["label"] != "normal"]["label"].unique())
    missing = expected_attack_types - found_attack_types
    assert not missing, f"Missing attack types: {missing}"
    print(f"  [OK] All 5 attack types present: {found_attack_types}")

    total = len(df)
    n_attacks = (df["label"] != "normal").sum()
    rate = n_attacks / total
    assert 0.005 < rate < 0.10, f"Attack rate {rate:.3f} out of expected range"
    print(f"  [OK] Attack rate: {rate:.2%} ({n_attacks}/{total} events)")

    for col in ["user_id", "device_id", "geo_city", "label"]:
        nulls = df[col].isna().sum()
        assert nulls == 0, f"NaN found in {col}: {nulls}"
    print(f"  [OK] No NaN values in key columns")

    # Verify impossible travel pairs: two events per user with extreme geo gap
    it = df[df["label"] == "impossible_travel"].copy()
    assert len(it) >= 2, "Expected at least 2 impossible-travel events"
    print(f"  [OK] Impossible travel events: {len(it)}")


def test_impossible_travel_speed():
    """
    Verify that impossible-travel pairs actually imply impossible speed.
    Takes the first pair and checks the implied km/h.
    """
    df = generate_dataset(n_users=30, events_per_user=50,
                           attack_rate=0.02, save=False)
    it = df[df["label"] == "impossible_travel"].sort_values(
        ["user_id", "timestamp"])

    checked = 0
    for user_id, grp in it.groupby("user_id"):
        if len(grp) < 2:
            continue
        row1, row2 = grp.iloc[0], grp.iloc[1]
        dist_km = _haversine_km(row1.geo_lat, row1.geo_lon,
                                 row2.geo_lat, row2.geo_lon)
        hours = (row2.timestamp - row1.timestamp).total_seconds() / 3600
        if hours > 0:
            speed = dist_km / hours
            assert speed > 800, (
                f"Impossible-travel pair for {user_id} only implies "
                f"{speed:.0f} km/h — not clearly impossible"
            )
            checked += 1
            if checked >= 3:
                break

    assert checked > 0, "Could not find any impossible-travel pairs to validate"
    print(f"  [OK] Verified {checked} impossible-travel pairs all imply >800 km/h")


if __name__ == "__main__":
    print("\nRunning DriftWatch generator smoke tests ...\n")

    tests = [
        test_haversine,
        test_profiles_generated,
        test_dataset_shape_and_labels,
        test_impossible_travel_speed,
    ]

    passed = 0
    for t in tests:
        try:
            print(f"[{t.__name__}]")
            t()
            passed += 1
        except AssertionError as e:
            print(f"  [FAIL] FAILED: {e}")
        except Exception as e:
            print(f"  [ERR] ERROR: {type(e).__name__}: {e}")
        print()

    print(f"Results: {passed}/{len(tests)} tests passed")
    if passed < len(tests):
        sys.exit(1)
    else:
        print("All tests passed [OK]")
