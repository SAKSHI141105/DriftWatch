# DriftWatch — AI-Powered SOC Behavioral Anomaly Detection & Drift Engine

> **Behavior has a rhythm. DriftWatch watches for the moment it breaks.**

DriftWatch is an enterprise-grade, real-time Security Operations Center (SOC) Behavioral Anomaly Detection System. Built on a 2-stage Machine Learning architecture, DriftWatch detects subtle insider threats, credential misuse, lateral movement, impossible travel, and brute force attacks while continuously monitoring for concept drift and incorporating active analyst feedback into model retraining cycles.

---

## System Interface & Architecture

- **Sleek Light & Dark Theme Support**: Designed with OKLCH color spaces, semantic Tailwind tokens, and seamless theme switching.
- **Real-Time Hot Path Scoring (<10ms)**: Sub-10ms event scoring pipeline connected via WebSockets for live threat streaming.
- **SHAP Explainability**: Plain-English threat attributions identifying exact feature deviations for SOC Tier-1/2 analysts.
- **Active Retraining Loop**: Persistent SQLite database storing analyst feedback (`confirm` / `dismiss` / `note`) for active learning retrains.

---

## Technical Architecture & ML Pipeline

DriftWatch uses a dual-layer inference pipeline coupled with online drift detection and adaptive baseline profiling.

```
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                            LIVE TELEMETRY STREAM                                │
 │               (User Logins, Auth Method, Geolocation, Bytes, Session)            │
 └─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                      BEHAVIORAL FEATURE EXTRACTION                              │
 │   - Personal vs. Population Baseline Profile Comparison                         │
 │   - Cold-Start Transition Evaluator (<50 events -> Population, >=50 -> Personal)  │
 │   - Hour Gaussian Offsets, Geovelocity (km/h), Device Fingerprint Unseen Check   │
 └─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                   STAGE 1: ISOLATION FOREST (Unsupervised)                      │
 │   - Computes raw anomaly score s in [0, 1]                                      │
 │   - Isolates unexpected behavioral deviations in high-dimensional feature space │
 └─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                   STAGE 2: XGBOOST CLASSIFIER (Supervised)                      │
 │   - Trained with SMOTE (Synthetic Minority Over-sampling Technique)            │
 │   - Classifies threat type & outputs class probability confidence               │
 │     [Credential Misuse, Brute Force, Lateral Movement, Impossible Travel]       │
 └─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                     EXPLAINABILITY & RISK SCORING                               │
 │   - Risk Score Calculation: Risk = f(Anomaly Score, Confidence, Attack Weight)    │
 │   - SHAP Feature Attribution: Human-readable explanation generation             │
 └─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
 ┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
 │   SQLite DB (driftwatch.db)         │   │      WebSocket Real-Time Broadcast  │
 │   - Risk >= 40: Flagged as Alert     │   │      - Pushed to SOC Threat Queue    │
 └──────────────────────────────────────┘   └──────────────────────────────────────┘
```

---

## Core Scientific Concepts & Algorithms

### 1. 2-Stage Hybrid Inference Engine
- **Stage 1 (Isolation Forest)**: Unsupervised tree-based anomaly detector that measures how easily a data point can be isolated from normal user clusters. Returns an anomaly score $s \in [0, 1]$.
- **Stage 2 (XGBoost Classifier + SMOTE)**: Supervised gradient boosting classifier trained on balanced synthetic minority classes (SMOTE) to identify specific attack patterns with probability confidence metrics.

### 2. Adaptive Baseline Profiling & Cold-Start Mitigation
- **Cold-Start Phase ($N < 50$ events)**: When a new employee joins, insufficient personal logs exist. DriftWatch evaluates their activity against a **Population Baseline** (role-based cluster profile).
- **Personal Baseline Phase ($N \ge 50$ events)**: Once 50 events are logged, DriftWatch dynamically transitions to a **Personal Baseline**, comparing login hours against Gaussian distributions $(\mu, \sigma)$ and device sets specific to that user.

### 3. Concept Drift & Distribution Shift Monitoring
- **ADWIN (Adaptive Windowing)**: Dynamically adjusts sliding window size based on changes in data variance. If data distribution changes significantly, an alert is triggered.
- **2-Sample Kolmogorov-Smirnov (KS-Test)**: Evaluates distance statistic $D$ and $p$-value across 12 behavioral features to detect gradual population drift (e.g. shifts in working hours due to remote work or daylight savings).

### 4. Active Learning & Analyst Retraining Loop
- Analysts review alerts on `/alerts/[id]` and can **Confirm** (True Positive), **Dismiss** (False Positive), or add **Audit Notes**.
- Labeled records write to SQLite. When 50 new feedback records accumulate, DriftWatch executes an incremental XGBoost retrain with SMOTE oversampling, preserving model version checkpoints (`v1.0`, `v1.1`, `v1.2`).

---

## Technology Stack

### Backend
- **Framework**: Python 3.11+, FastAPI, Uvicorn (ASGI)
- **Machine Learning**: Scikit-Learn (Isolation Forest), XGBoost, Imbalanced-Learn (SMOTE)
- **Data & Math**: Pandas, NumPy, PyArrow (Parquet)
- **Database**: SQLite 3 with Write-Ahead Logging (WAL Mode)
- **Real-time**: WebSockets (`/ws/alerts`)

### Frontend
- **Framework**: Next.js 16 (App Router + Turbopack), React 19, TypeScript
- **Styling**: Tailwind CSS v4, OKLCH Color Spaces, `next-themes` (Dark/Light Mode)
- **Animations & Icons**: Framer Motion, Lucide React Icons
- **Components**: Custom Radix-style UI primitives (`Card`, `Button`, `Badge`, `Input`)

---

## API Endpoints Reference

### REST API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Backend system health check & ML model load status |
| `GET` | `/api/alerts` | Query threat alerts with pagination, status, & risk filtering |
| `GET` | `/api/alerts/{id}` | Detailed investigation telemetry, SHAP reasons, & note history |
| `POST` | `/api/alerts/{id}/feedback` | Write analyst verification (`confirm`, `dismiss`, `note`) to SQLite |
| `POST` | `/api/score` | Hot path real-time event scoring (<10ms) |
| `GET` | `/api/metrics` | Model evaluation benchmarks (ROC-AUC, FPR, open/confirmed counts) |
| `POST` | `/api/telemetry/refresh` | Inject fresh synthetic access logs batch & score dynamically |
| `GET` | `/api/drift` | Per-feature Kolmogorov-Smirnov statistics & ADWIN status |
| `GET` | `/api/retraining` | Active learning feedback counts & model version history |

### WebSockets

| Endpoint | Protocol | Description |
| :--- | :--- | :--- |
| `/ws/alerts` | `WSS` / `WS` | Real-time push stream for newly flagged behavioral alerts |

---

## Local Setup & Execution Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and `npm`

### 1. Backend Setup

```bash
# Navigate to project root
cd DriftWatch

# Install Python dependencies
pip install -r backend/requirements.txt

# Start FastAPI backend server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend server will start at `http://localhost:8000`. You can access interactive OpenAPI docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## Production Deployment Guide

### Option A: Render.com (Backend) + Vercel (Frontend) — Recommended Free Tier

#### 1. Deploy Backend on Render.com (Free Web Service)
1. Log in to [Render](https://render.com) and connect your GitHub repo `SAKSHI141105/DriftWatch`.
2. Select **New Web Service**:
   - **Language**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance**: Free ($0/mo)
3. Copy your live backend URL (e.g. `https://driftwatch-7bng.onrender.com`).

#### 2. Deploy Frontend on Vercel (Free)
1. Log in to [Vercel](https://vercel.com) and import `SAKSHI141105/DriftWatch`.
2. Set **Root Directory**: `frontend`
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://driftwatch-7bng.onrender.com/api`
   - `NEXT_PUBLIC_WS_URL` = `wss://driftwatch-7bng.onrender.com/ws/alerts`
4. Click **Deploy**. Vercel will launch your app live in under 1 minute!
