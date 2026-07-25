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
    return dict(row) if row else None


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
