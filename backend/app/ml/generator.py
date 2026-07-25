"""
Synthetic access-log generator for DriftWatch.

Simulates a population of users with realistic behavioral baselines,
then injects 5 labeled attack types on top of the normal stream.

Attack injection rate is deliberately kept at ~2% so the downstream
models face a realistic class-imbalance problem (which we then address
explicitly with SMOTE / class-weighting — that's part of the pitch).

Ground-truth labels live in the `label` column and are NEVER fed
into unsupervised training — only used for evaluation.
"""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from faker import Faker

# ---------------------------------------------------------------------------
# Reproducibility — fix seeds so demo data is the same every run
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)
fake = Faker()
Faker.seed(RANDOM_SEED)

# ---------------------------------------------------------------------------
# City pool with lat/lon — used for geolocation simulation.
# Spread across continents so impossible-travel pairs are unambiguous.
# ---------------------------------------------------------------------------
CITIES: list[tuple[str, float, float]] = [
    ("New York",     40.71, -74.01),
    ("London",       51.51,  -0.13),
    ("Tokyo",        35.68, 139.69),
    ("Sydney",      -33.87, 151.21),
    ("São Paulo",   -23.55, -46.63),
    ("Dubai",        25.20,  55.27),
    ("Singapore",     1.35, 103.82),
    ("Mumbai",       19.08,  72.88),
    ("Paris",        48.85,   2.35),
    ("Chicago",      41.88, -87.63),
    ("Toronto",      43.65, -79.38),
    ("Berlin",       52.52,  13.41),
    ("Oslo",         59.91,  10.75),
    ("Cape Town",   -33.93,  18.42),
    ("Mexico City",  19.43, -99.13),
    ("Seoul",        37.57, 126.98),
    ("Bangkok",      13.75, 100.52),
    ("Jakarta",      -6.21, 106.85),
]

RESOURCES = [
    "hr-portal", "finance-db", "source-code-repo", "admin-console",
    "employee-directory", "vpn-gateway", "analytics-dashboard",
    "payroll-system", "identity-service", "logging-service",
    "backup-storage", "ci-cd-pipeline", "secrets-manager", "api-gateway",
    "customer-data-lake", "security-audit-log", "dev-cluster",
    "prod-cluster", "inventory-db", "email-server",
]

ACTIONS = ["login", "read", "write", "escalate"]
AUTH_METHODS = ["password", "mfa", "sso", "certificate", "api-key"]

# Max physically plausible travel speed (km/h).
# Commercial flight is ~900 km/h; 800 gives a small buffer for impossible-
# travel pairs while staying clearly above real travel speeds.
MAX_TRAVEL_SPEED_KMH = 800.0


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@dataclass
class UserProfile:
    """Captures a single synthetic user's behavioral baseline."""

    user_id: str
    # Home city index into CITIES list
    home_city_idx: int
    # Peak login hour (0–23), modelled as Gaussian center
    typical_login_hour: float
    # Std-dev of login-hour distribution (hours)
    login_hour_std: float
    # 2–3 assigned device IDs
    devices: list[str]
    # 3–5 resources this user typically touches
    typical_resources: list[str]
    # Mean session duration (minutes)
    session_duration_mean: float
    session_duration_std: float
    # Mean bytes transferred per session
    bytes_mean: float
    bytes_std: float
    # Probability of each auth method (index matches AUTH_METHODS)
    auth_method_probs: list[float]
    # Typical failure rate (normal users occasionally mis-type passwords)
    failure_rate: float = 0.03
    # Role label used for cold-start population baseline grouping
    role: str = "standard"


def _make_user_profiles(n_users: int = 100) -> list[UserProfile]:
    """Create `n_users` synthetic users with varied but realistic baselines."""
    profiles: list[UserProfile] = []

    roles = ["standard", "admin", "developer", "analyst"]

    for i in range(n_users):
        role = random.choice(roles)

        # Admins work late, developers have spread hours
        if role == "admin":
            login_hour = np.random.uniform(8, 18)
            login_std = 1.5
        elif role == "developer":
            login_hour = np.random.uniform(9, 22)
            login_std = 2.5
        else:
            login_hour = np.random.uniform(7, 17)
            login_std = 1.0

        # Admins use MFA/certificates more; analysts use SSO
        if role == "admin":
            auth_probs = [0.05, 0.60, 0.10, 0.20, 0.05]
        elif role == "developer":
            auth_probs = [0.10, 0.20, 0.10, 0.40, 0.20]
        elif role == "analyst":
            auth_probs = [0.10, 0.30, 0.50, 0.05, 0.05]
        else:
            auth_probs = [0.35, 0.30, 0.25, 0.05, 0.05]

        n_devices = random.randint(2, 3)
        n_resources = random.randint(3, 5)

        profiles.append(UserProfile(
            user_id=f"user_{i:04d}",
            home_city_idx=random.randint(0, len(CITIES) - 1),
            typical_login_hour=login_hour,
            login_hour_std=login_std,
            devices=[str(uuid.uuid4())[:8] for _ in range(n_devices)],
            typical_resources=random.sample(RESOURCES, k=n_resources),
            session_duration_mean=random.uniform(10, 90),
            session_duration_std=random.uniform(5, 20),
            bytes_mean=random.uniform(500, 50000),
            bytes_std=random.uniform(100, 10000),
            auth_method_probs=auth_probs,
            failure_rate=random.uniform(0.01, 0.06),
            role=role,
        ))

    return profiles


# ---------------------------------------------------------------------------
# Normal event generation
# ---------------------------------------------------------------------------

def _make_timestamp(base_date: datetime, hour_center: float,
                     hour_std: float) -> datetime:
    """Sample a timestamp Gaussian-distributed around a user's typical hour."""
    hour = float(np.clip(np.random.normal(hour_center, hour_std), 0, 23))
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    day_offset = random.randint(0, 89)  # spread over ~3 months of history
    ts = base_date + timedelta(days=day_offset, hours=hour,
                                minutes=minute, seconds=second)
    return ts


def _normal_event(user: UserProfile, base_date: datetime) -> dict:
    """Generate one normal access event for a user."""
    city_name, lat, lon = CITIES[user.home_city_idx]
    # Small jitter on lat/lon to simulate mobile connections within same city
    lat += np.random.normal(0, 0.05)
    lon += np.random.normal(0, 0.05)

    success = random.random() > user.failure_rate
    action = random.choice(ACTIONS)
    # Failed logins are almost always "login" actions
    if not success:
        action = "login"

    return {
        "timestamp": _make_timestamp(base_date, user.typical_login_hour,
                                      user.login_hour_std),
        "user_id": user.user_id,
        "device_id": random.choice(user.devices),
        "source_ip": fake.ipv4_private(),
        "geo_city": city_name,
        "geo_lat": round(lat, 4),
        "geo_lon": round(lon, 4),
        "resource_accessed": random.choice(user.typical_resources),
        "action": action,
        "auth_method": random.choices(AUTH_METHODS,
                                       weights=user.auth_method_probs)[0],
        "session_duration_s": max(
            10, int(np.random.normal(user.session_duration_mean * 60,
                                     user.session_duration_std * 60))
        ),
        "bytes_transferred": max(
            0, int(np.random.normal(user.bytes_mean, user.bytes_std))
        ),
        "success": success,
        "label": "normal",
        "role": user.role,
    }


# ---------------------------------------------------------------------------
# Attack injection — one function per attack type
# ---------------------------------------------------------------------------

def _inject_credential_misuse(user: UserProfile,
                                base_date: datetime) -> list[dict]:
    """
    Credential misuse: a successful login from an unknown device/IP at an
    unusual hour (off the user's normal schedule by >4 sigma).
    """
    off_hour = (user.typical_login_hour + random.uniform(6, 10)) % 24
    city_name, lat, lon = random.choice(
        [c for i, c in enumerate(CITIES) if i != user.home_city_idx]
    )
    novel_device = str(uuid.uuid4())[:8]  # device never seen for this user

    ts = base_date + timedelta(
        days=random.randint(5, 85),
        hours=off_hour,
        minutes=random.randint(0, 59),
    )

    return [{
        "timestamp": ts,
        "user_id": user.user_id,
        "device_id": novel_device,
        "source_ip": fake.ipv4_public(),
        "geo_city": city_name,
        "geo_lat": round(lat, 4),
        "geo_lon": round(lon, 4),
        "resource_accessed": random.choice(RESOURCES),
        "action": "login",
        "auth_method": random.choice(["password", "api-key"]),
        "session_duration_s": random.randint(30, 300),
        "bytes_transferred": random.randint(0, 1000),
        "success": True,  # successful — that's what makes it dangerous
        "label": "credential_misuse",
        "role": user.role,
    }]


def _inject_brute_force(user: UserProfile,
                         base_date: datetime) -> list[dict]:
    """
    Brute force: 10–20 rapid failed logins from the same IP in a 2-min window,
    sometimes followed by one success (simulates password-spray finding a hit).
    """
    n_attempts = random.randint(10, 20)
    base_ts = base_date + timedelta(
        days=random.randint(5, 85),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 58),
    )
    attacker_ip = fake.ipv4_public()
    events = []

    for i in range(n_attempts):
        ts = base_ts + timedelta(seconds=i * random.randint(3, 8))
        events.append({
            "timestamp": ts,
            "user_id": user.user_id,
            "device_id": random.choice(user.devices),
            "source_ip": attacker_ip,  # all from same IP — key feature
            "geo_city": CITIES[user.home_city_idx][0],
            "geo_lat": CITIES[user.home_city_idx][1],
            "geo_lon": CITIES[user.home_city_idx][2],
            "resource_accessed": "identity-service",
            "action": "login",
            "auth_method": "password",
            "session_duration_s": random.randint(1, 5),
            "bytes_transferred": 0,
            "success": False,  # all failures — the signal
            "label": "brute_force",
            "role": user.role,
        })

    return events


def _inject_lateral_movement(user: UserProfile,
                               base_date: datetime) -> list[dict]:
    """
    Lateral movement: one session touching an unusually large breadth of
    resources/hosts — far more than this user's normal 3–5 resources.
    """
    # Touch most of RESOURCES in one session — abnormal breadth
    n_touched = random.randint(10, len(RESOURCES))
    touched = random.sample(RESOURCES, k=n_touched)

    base_ts = base_date + timedelta(
        days=random.randint(5, 85),
        hours=user.typical_login_hour,
        minutes=random.randint(0, 30),
    )
    events = []
    for i, resource in enumerate(touched):
        ts = base_ts + timedelta(minutes=i * random.randint(1, 3))
        events.append({
            "timestamp": ts,
            "user_id": user.user_id,
            "device_id": random.choice(user.devices),
            "source_ip": fake.ipv4_private(),
            "geo_city": CITIES[user.home_city_idx][0],
            "geo_lat": CITIES[user.home_city_idx][1],
            "geo_lon": CITIES[user.home_city_idx][2],
            "resource_accessed": resource,
            "action": random.choice(["read", "write", "escalate"]),
            "auth_method": random.choices(
                AUTH_METHODS, weights=user.auth_method_probs)[0],
            "session_duration_s": random.randint(60, 300),
            "bytes_transferred": random.randint(1000, 100000),
            "success": True,
            "label": "lateral_movement",
            "role": user.role,
        })
    return events


def _haversine_km(lat1: float, lon1: float,
                   lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points in km."""
    R = 6371.0
    φ1, φ2 = np.radians(lat1), np.radians(lat2)
    dφ = np.radians(lat2 - lat1)
    dλ = np.radians(lon2 - lon1)
    a = np.sin(dφ / 2) ** 2 + np.cos(φ1) * np.cos(φ2) * np.sin(dλ / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


def _inject_impossible_travel(user: UserProfile,
                                base_date: datetime) -> list[dict]:
    """
    Impossible travel: two successful logins by the same user, with
    geolocations implying travel faster than MAX_TRAVEL_SPEED_KMH.
    We pick two cities >5000 km apart and schedule them <30 minutes apart.
    """
    # Pick a distant city — guaranteed to be far from home
    home_lat, home_lon = (CITIES[user.home_city_idx][1],
                           CITIES[user.home_city_idx][2])
    far_cities = [
        (name, lat, lon)
        for name, lat, lon in CITIES
        if _haversine_km(home_lat, home_lon, lat, lon) > 5000
    ]
    if not far_cities:
        # Fallback: just pick any city that isn't home
        far_cities = [c for i, c in enumerate(CITIES)
                      if i != user.home_city_idx]

    far_city_name, far_lat, far_lon = random.choice(far_cities)

    base_ts = base_date + timedelta(
        days=random.randint(5, 85),
        hours=user.typical_login_hour,
        minutes=random.randint(0, 30),
    )
    # Second login 10–40 minutes later — physically impossible to have traveled
    gap_minutes = random.randint(10, 40)
    ts2 = base_ts + timedelta(minutes=gap_minutes)

    home_city = CITIES[user.home_city_idx]

    return [
        {
            "timestamp": base_ts,
            "user_id": user.user_id,
            "device_id": random.choice(user.devices),
            "source_ip": fake.ipv4_private(),
            "geo_city": home_city[0],
            "geo_lat": home_city[1],
            "geo_lon": home_city[2],
            "resource_accessed": random.choice(user.typical_resources),
            "action": "login",
            "auth_method": random.choices(
                AUTH_METHODS, weights=user.auth_method_probs)[0],
            "session_duration_s": random.randint(60, 300),
            "bytes_transferred": random.randint(500, 5000),
            "success": True,
            "label": "impossible_travel",
            "role": user.role,
        },
        {
            "timestamp": ts2,
            "user_id": user.user_id,
            "device_id": random.choice(user.devices),
            "source_ip": fake.ipv4_public(),
            "geo_city": far_city_name,
            "geo_lat": round(far_lat, 4),
            "geo_lon": round(far_lon, 4),
            "resource_accessed": random.choice(RESOURCES),
            "action": "login",
            "auth_method": random.choice(["password", "sso"]),
            "session_duration_s": random.randint(30, 200),
            "bytes_transferred": random.randint(200, 3000),
            "success": True,
            "label": "impossible_travel",
            "role": user.role,
        },
    ]


def _inject_device_spoofing(
        user: UserProfile,
        all_users: list[UserProfile],
        base_date: datetime,
) -> list[dict]:
    """
    Device spoofing: access from a device fingerprint that either
    (a) belongs to a completely different user, or
    (b) has never appeared in this user's history at all.
    """
    # 50% chance: reuse another user's device (cross-user spoofing)
    if random.random() < 0.5 and len(all_users) > 1:
        other_user = random.choice([u for u in all_users
                                     if u.user_id != user.user_id])
        spoofed_device = random.choice(other_user.devices)
    else:
        # Novel device fingerprint — never seen for anyone
        spoofed_device = str(uuid.uuid4())[:8]

    ts = base_date + timedelta(
        days=random.randint(5, 85),
        hours=user.typical_login_hour + random.uniform(-2, 2),
        minutes=random.randint(0, 59),
    )
    city = CITIES[user.home_city_idx]

    return [{
        "timestamp": ts,
        "user_id": user.user_id,
        "device_id": spoofed_device,  # the anomaly: not in user's device set
        "source_ip": fake.ipv4_public(),
        "geo_city": city[0],
        "geo_lat": city[1],
        "geo_lon": city[2],
        "resource_accessed": random.choice(RESOURCES),
        "action": random.choice(ACTIONS),
        "auth_method": random.choice(AUTH_METHODS),
        "session_duration_s": random.randint(60, 600),
        "bytes_transferred": random.randint(1000, 50000),
        "success": random.choice([True, False]),
        "label": "device_spoofing",
        "role": user.role,
    }]


# ---------------------------------------------------------------------------
# Main dataset generator
# ---------------------------------------------------------------------------

def generate_dataset(
    n_users: int = 100,
    events_per_user: int = 200,
    attack_rate: float = 0.02,
    output_dir: Optional[Path] = None,
    save: bool = True,
) -> pd.DataFrame:
    """
    Generate the full synthetic dataset and (optionally) write to disk.

    Args:
        n_users: Number of synthetic users to simulate.
        events_per_user: Approximate normal events per user.
        attack_rate: Target fraction of rows that are attack events.
                     Kept at ~2% to create realistic class imbalance.
        output_dir: Where to write Parquet + CSV. Defaults to backend/data/.
        save: Whether to write files to disk.

    Returns:
        DataFrame with all events (normal + attack), sorted by timestamp.
    """
    print(f"Generating dataset: {n_users} users, ~{events_per_user} events each ...")

    profiles = _make_user_profiles(n_users)
    # Simulation base date — three months ago so history exists
    base_date = datetime(2025, 4, 1, tzinfo=timezone.utc)

    # ---- Normal events ----
    normal_rows: list[dict] = []
    for user in profiles:
        for _ in range(events_per_user):
            normal_rows.append(_normal_event(user, base_date))

    n_normal = len(normal_rows)

    # ---- Attack injection ----
    # Decide how many total attack events we need to hit the target rate
    # total = n_normal + n_attacks  =>  attack_rate = n_attacks / total
    # =>  n_attacks = n_normal * attack_rate / (1 - attack_rate)
    n_attacks_target = int(n_normal * attack_rate / (1 - attack_rate))

    attack_types = [
        "credential_misuse",
        "brute_force",
        "lateral_movement",
        "impossible_travel",
        "device_spoofing",
    ]

    attack_rows: list[dict] = []
    # Distribute attack budget roughly equally across types, with variation
    attacks_per_type = max(1, n_attacks_target // len(attack_types))

    attack_funcs = {
        "credential_misuse": lambda u: _inject_credential_misuse(u, base_date),
        "brute_force":       lambda u: _inject_brute_force(u, base_date),
        "lateral_movement":  lambda u: _inject_lateral_movement(u, base_date),
        "impossible_travel": lambda u: _inject_impossible_travel(u, base_date),
        "device_spoofing":   lambda u: _inject_device_spoofing(
            u, profiles, base_date),
    }

    for attack_type, inject_fn in attack_funcs.items():
        count = 0
        while count < attacks_per_type:
            victim = random.choice(profiles)
            new_events = inject_fn(victim)
            attack_rows.extend(new_events)
            count += len(new_events)

    # ---- Combine and sort ----
    all_rows = normal_rows + attack_rows
    df = pd.DataFrame(all_rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Assign a stable event_id so the API can reference individual events
    df.insert(0, "event_id", [str(uuid.uuid4()) for _ in range(len(df))])

    # ---- Summary ----
    label_counts = df["label"].value_counts()
    total = len(df)
    print(f"\n{'='*50}")
    print(f"Total events generated: {total:,}")
    print(f"{'Label':<25} {'Count':>8} {'%':>8}")
    print(f"{'-'*45}")
    for label, cnt in label_counts.items():
        print(f"{label:<25} {cnt:>8,} {cnt/total*100:>7.2f}%")
    print(f"{'='*50}")
    attack_total = df[df["label"] != "normal"].shape[0]
    print(f"Overall attack rate: {attack_total/total*100:.2f}%\n")

    # ---- Persist ----
    if save:
        if output_dir is None:
            # File is at backend/app/ml/generator.py — 3 parents up → repo root,
            # then down to backend/data/
            output_dir = Path(__file__).parent.parent.parent / "data"
        output_dir.mkdir(parents=True, exist_ok=True)

        parquet_path = output_dir / "access_logs.parquet"
        csv_path = output_dir / "access_logs.csv"
        df.to_parquet(parquet_path, index=False)
        df.to_csv(csv_path, index=False)
        print(f"Saved: {parquet_path}")
        print(f"Saved: {csv_path}")

    return df


# ---------------------------------------------------------------------------
# Entry point — run directly to generate data
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    df = generate_dataset(
        n_users=100,
        events_per_user=200,
        attack_rate=0.02,
        save=True,
    )
