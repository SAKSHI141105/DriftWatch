"""Pydantic schemas for the DriftWatch API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class AlertBase(BaseModel):
    event_id: str
    timestamp: datetime
    user_id: str
    device_id: str
    source_ip: str
    geo_city: str
    geo_lat: float
    geo_lon: float
    resource_accessed: str
    action: str
    auth_method: str
    session_duration_s: int
    bytes_transferred: int
    success: bool

    @field_validator("success", mode="before")
    @classmethod
    def coerce_success(cls, v):
        """SQLite stores booleans as 0/1 integers."""
        return bool(v)


class FeedbackRecord(BaseModel):
    id: Optional[int] = None
    alert_id: str
    action: str
    note: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class Alert(AlertBase):
    id: str
    risk_score: int                 # 0–100
    attack_type: str                # 'brute_force' | 'credential_misuse' | ...
    confidence: float               # classifier confidence [0,1]
    anomaly_score: float            # Layer 1 raw score [0,1]
    reason: str                     # plain-English explanation
    baseline_type: str              # 'personal' | 'population'
    cold_start: bool
    status: str                     # 'open' | 'confirmed' | 'dismissed'
    true_label: Optional[str] = None   # ground truth (for metrics only)
    role: Optional[str] = None
    notes: list[FeedbackRecord] = []
    latest_note: Optional[str] = None

    @field_validator("cold_start", mode="before")
    @classmethod
    def coerce_cold_start(cls, v):
        """SQLite stores booleans as 0/1 integers."""
        return bool(v)

    class Config:
        from_attributes = True


class AlertSummary(BaseModel):
    """Lightweight version for the alert queue listing."""
    id: str
    timestamp: datetime
    user_id: str
    geo_city: str
    resource_accessed: str
    action: str
    risk_score: int
    attack_type: str
    confidence: float
    reason: str
    baseline_type: str
    status: str


class ScoreRequest(BaseModel):
    """Payload for POST /score — a single raw log event."""
    event_id: Optional[str] = None
    timestamp: datetime
    user_id: str
    device_id: str
    source_ip: str
    geo_city: str
    geo_lat: float
    geo_lon: float
    resource_accessed: str
    action: str
    auth_method: str
    session_duration_s: int
    bytes_transferred: int
    success: bool
    role: Optional[str] = "standard"


class ScoreResponse(BaseModel):
    event_id: str
    risk_score: int
    attack_type: str
    confidence: float
    anomaly_score: float
    reason: str
    baseline_type: str
    alert_id: Optional[str] = None  # set if event was flagged (risk > threshold)


class FeedbackRequest(BaseModel):
    action: str   # 'confirm' | 'dismiss'
    note: Optional[str] = None


class PerClassMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    pr_auc: float
    support: int


class MetricsResponse(BaseModel):
    anomaly_roc_auc: float
    anomaly_pr_auc: float
    anomaly_fpr: float
    classifier_metrics: dict[str, PerClassMetrics]
    total_alerts: int
    open_alerts: int
    confirmed_alerts: int
    dismissed_alerts: int
    drift_detected: bool
    drift_users_affected: int
    drift_checked_at: Optional[str]
    cold_start_users: int


class AlertsResponse(BaseModel):
    alerts: list[AlertSummary]
    total: int
    page: int
    limit: int
    pages: int
