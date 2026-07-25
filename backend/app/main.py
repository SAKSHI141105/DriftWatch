"""
FastAPI application entry point for DriftWatch.

Loads all ML models into memory on startup (lifespan) so that
real-time scoring requests do not incur disk I/O latency.
"""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db import init_db
from app.ml.anomaly_model import load_model_artifacts
from app.ml.classifier import load_classifier_artifacts
from app.api import alerts, score, metrics, feedback, ws

# Global application state for ML models
app_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing SQLite database...")
    init_db()

    print("Loading ML models into memory...")
    try:
        if_model, if_scaler, baselines, feature_cols = load_model_artifacts()
        clf, clf_scaler, le = load_classifier_artifacts()
        
        app_state["if_model"] = if_model
        app_state["if_scaler"] = if_scaler
        app_state["baselines"] = baselines
        app_state["feature_cols"] = feature_cols
        app_state["clf"] = clf
        app_state["clf_scaler"] = clf_scaler
        app_state["le"] = le
        print("ML models loaded successfully.")
    except Exception as e:
        print(f"Warning: Could not load ML model artifacts ({e}). Run python backend/app/ml/score_all.py first.")

    yield
    print("Shutting down DriftWatch API...")
    app_state.clear()


app = FastAPI(
    title="DriftWatch API",
    description="AI-Powered Behavioral Anomaly Detection System for Cybersecurity",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(score.router, prefix="/api", tags=["Scoring"])
app.include_router(metrics.router, prefix="/api", tags=["Metrics"])
app.include_router(feedback.router, prefix="/api", tags=["Feedback"])
app.include_router(ws.router, tags=["WebSocket"])


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "models_loaded": bool(app_state.get("if_model") and app_state.get("clf")),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
