"""
SQLite database layer for DriftWatch.

Keeps the data layer simple — a single table for alerts, with
indices on the columns the API sorts and filters on.

In production this would be Postgres + Redis, but SQLite is
sufficient for the demo and removes infra dependencies.
"""

from __future__ import annotations

import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "data" / "driftwatch.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # better concurrent reads
    return conn


@contextmanager
def db_conn():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they don't exist."""
    with db_conn() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id                TEXT PRIMARY KEY,
            event_id          TEXT UNIQUE NOT NULL,
            timestamp         TEXT NOT NULL,
            user_id           TEXT NOT NULL,
            device_id         TEXT NOT NULL,
            source_ip         TEXT NOT NULL,
            geo_city          TEXT NOT NULL,
            geo_lat           REAL NOT NULL,
            geo_lon           REAL NOT NULL,
            resource_accessed TEXT NOT NULL,
            action            TEXT NOT NULL,
            auth_method       TEXT NOT NULL,
            session_duration_s INTEGER NOT NULL,
            bytes_transferred INTEGER NOT NULL,
            success           INTEGER NOT NULL,
            risk_score        INTEGER NOT NULL,
            attack_type       TEXT NOT NULL,
            confidence        REAL NOT NULL,
            anomaly_score     REAL NOT NULL,
            reason            TEXT NOT NULL,
            baseline_type     TEXT NOT NULL,
            cold_start        INTEGER NOT NULL DEFAULT 0,
            status            TEXT NOT NULL DEFAULT 'open',
            true_label        TEXT,
            role              TEXT,
            created_at        TEXT NOT NULL
        )
        """)
        conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_risk ON alerts(risk_score DESC)
        """)
        conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_attack ON alerts(attack_type)
        """)
        conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_status ON alerts(status)
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id    TEXT NOT NULL,
            action      TEXT NOT NULL,
            note        TEXT,
            created_at  TEXT NOT NULL,
            FOREIGN KEY(alert_id) REFERENCES alerts(id)
        )
        """)

        # Seed initial sample alerts if empty
        alert_cnt = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
        if alert_cnt == 0:
            import uuid
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            sample_alerts = [
                {
                    "id": str(uuid.uuid4()), "event_id": str(uuid.uuid4()), "timestamp": now,
                    "user_id": "user_0099", "device_id": "dev_spoofed_88", "source_ip": "185.220.101.5",
                    "geo_city": "Oslo", "geo_lat": 59.9139, "geo_lon": 10.7522,
                    "resource_accessed": "prod-aws-vault", "action": "login", "auth_method": "password",
                    "session_duration_s": 12, "bytes_transferred": 1024, "success": 1,
                    "risk_score": 96, "attack_type": "credential_misuse", "confidence": 0.98,
                    "anomaly_score": 0.89, "reason": "Risk score 96/100 — flagged as credential misuse. Device fingerprint 'dev_spoofed_88' is unseen for user_0099. Access from high-risk IP 185.220.101.5.",
                    "baseline_type": "personal", "cold_start": 0, "status": "open",
                    "true_label": "credential_misuse", "role": "standard", "created_at": now
                },
                {
                    "id": str(uuid.uuid4()), "event_id": str(uuid.uuid4()), "timestamp": now,
                    "user_id": "user_0012", "device_id": "dev_bot_net_01", "source_ip": "45.142.120.10",
                    "geo_city": "Tokyo", "geo_lat": 35.6762, "geo_lon": 139.6503,
                    "resource_accessed": "hr-payroll-db", "action": "login", "auth_method": "password",
                    "session_duration_s": 5, "bytes_transferred": 500, "success": 0,
                    "risk_score": 88, "attack_type": "brute_force", "confidence": 0.95,
                    "anomaly_score": 0.82, "reason": "Risk score 88/100 — flagged as brute force attack. 15 failed authentication attempts within 2 minutes.",
                    "baseline_type": "personal", "cold_start": 0, "status": "open",
                    "true_label": "brute_force", "role": "standard", "created_at": now
                },
                {
                    "id": str(uuid.uuid4()), "event_id": str(uuid.uuid4()), "timestamp": now,
                    "user_id": "user_0005", "device_id": "dev_reg_22", "source_ip": "10.0.4.19",
                    "geo_city": "New York", "geo_lat": 40.7128, "geo_lon": -74.006,
                    "resource_accessed": "security-audit-log", "action": "read", "auth_method": "sso",
                    "session_duration_s": 900, "bytes_transferred": 10485760, "success": 1,
                    "risk_score": 78, "attack_type": "lateral_movement", "confidence": 0.91,
                    "anomaly_score": 0.74, "reason": "Risk score 78/100 — flagged as lateral movement. 6 distinct sensitive network resources accessed sequentially.",
                    "baseline_type": "personal", "cold_start": 0, "status": "open",
                    "true_label": "lateral_movement", "role": "admin", "created_at": now
                }
            ]
            conn.executemany("""
            INSERT OR IGNORE INTO alerts (
                id, event_id, timestamp, user_id, device_id, source_ip,
                geo_city, geo_lat, geo_lon, resource_accessed, action,
                auth_method, session_duration_s, bytes_transferred, success,
                risk_score, attack_type, confidence, anomaly_score, reason,
                baseline_type, cold_start, status, true_label, role, created_at
            ) VALUES (
                :id, :event_id, :timestamp, :user_id, :device_id, :source_ip,
                :geo_city, :geo_lat, :geo_lon, :resource_accessed, :action,
                :auth_method, :session_duration_s, :bytes_transferred, :success,
                :risk_score, :attack_type, :confidence, :anomaly_score, :reason,
                :baseline_type, :cold_start, :status, :true_label, :role, :created_at
            )
            """, sample_alerts)


def insert_alert(alert: dict) -> None:
    with db_conn() as conn:
        conn.execute("""
        INSERT OR IGNORE INTO alerts (
            id, event_id, timestamp, user_id, device_id, source_ip,
            geo_city, geo_lat, geo_lon, resource_accessed, action,
            auth_method, session_duration_s, bytes_transferred, success,
            risk_score, attack_type, confidence, anomaly_score, reason,
            baseline_type, cold_start, status, true_label, role, created_at
        ) VALUES (
            :id, :event_id, :timestamp, :user_id, :device_id, :source_ip,
            :geo_city, :geo_lat, :geo_lon, :resource_accessed, :action,
            :auth_method, :session_duration_s, :bytes_transferred, :success,
            :risk_score, :attack_type, :confidence, :anomaly_score, :reason,
            :baseline_type, :cold_start, :status, :true_label, :role, :created_at
        )
        """, alert)


def bulk_insert_alerts(alerts: list[dict]) -> int:
    """Insert many alerts, skip duplicates. Returns count inserted."""
    with db_conn() as conn:
        before = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
        conn.executemany("""
        INSERT OR IGNORE INTO alerts (
            id, event_id, timestamp, user_id, device_id, source_ip,
            geo_city, geo_lat, geo_lon, resource_accessed, action,
            auth_method, session_duration_s, bytes_transferred, success,
            risk_score, attack_type, confidence, anomaly_score, reason,
            baseline_type, cold_start, status, true_label, role, created_at
        ) VALUES (
            :id, :event_id, :timestamp, :user_id, :device_id, :source_ip,
            :geo_city, :geo_lat, :geo_lon, :resource_accessed, :action,
            :auth_method, :session_duration_s, :bytes_transferred, :success,
            :risk_score, :attack_type, :confidence, :anomaly_score, :reason,
            :baseline_type, :cold_start, :status, :true_label, :role, :created_at
        )
        """, alerts)
        after = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    return after - before


def get_alerts(
    page: int = 1,
    limit: int = 20,
    attack_type: Optional[str] = None,
    status: Optional[str] = None,
    min_risk: int = 0,
) -> tuple[list[dict], int]:
    offset = (page - 1) * limit
    filters = ["1=1"]
    params: list = []

    if attack_type:
        filters.append("attack_type = ?")
        params.append(attack_type)
    if status:
        filters.append("status = ?")
        params.append(status)
    if min_risk > 0:
        filters.append("risk_score >= ?")
        params.append(min_risk)

    where = " AND ".join(filters)

    with db_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM alerts WHERE {where}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"""SELECT * FROM alerts WHERE {where}
                ORDER BY risk_score DESC, timestamp DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ).fetchall()

    return [dict(r) for r in rows], total


def get_alert_by_id(alert_id: str) -> Optional[dict]:
    with db_conn() as conn:
        row = conn.execute(
            "SELECT * FROM alerts WHERE id = ?", (alert_id,)
        ).fetchone()
        if not row:
            return None
        alert_dict = dict(row)
        
        # Fetch associated feedback records / notes
        fb_rows = conn.execute(
            "SELECT id, alert_id, action, note, created_at FROM feedback "
            "WHERE alert_id = ? ORDER BY created_at DESC",
            (alert_id,)
        ).fetchall()
        
        notes_list = [dict(r) for r in fb_rows]
        alert_dict["notes"] = notes_list
        # Find latest non-empty note
        latest_note = None
        for fb in notes_list:
            if fb.get("note"):
                latest_note = fb["note"]
                break
        alert_dict["latest_note"] = latest_note
        
    return alert_dict


def update_alert_status(alert_id: str, status: str) -> bool:
    with db_conn() as conn:
        cur = conn.execute(
            "UPDATE alerts SET status = ? WHERE id = ?", (status, alert_id)
        )
    return cur.rowcount > 0


def insert_feedback(alert_id: str, action: str,
                     note: Optional[str], ts: str) -> None:
    with db_conn() as conn:
        conn.execute(
            "INSERT INTO feedback (alert_id, action, note, created_at) "
            "VALUES (?, ?, ?, ?)",
            (alert_id, action, note, ts),
        )


def get_alert_counts() -> dict:
    with db_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
        open_c = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE status='open'"
        ).fetchone()[0]
        confirmed = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE status='confirmed'"
        ).fetchone()[0]
        dismissed = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE status='dismissed'"
        ).fetchone()[0]
    return {
        "total": total, "open": open_c,
        "confirmed": confirmed, "dismissed": dismissed
    }


def get_recent_alerts(limit: int = 5) -> list[dict]:
    """Used by the WebSocket stream to push newly-created alerts."""
    with db_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]
