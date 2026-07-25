# DriftWatch

> **AI-Powered Behavioral Anomaly Detection for Cybersecurity**  
> Honeywell Hackathon Submission

DriftWatch learns what "normal" looks like for every user and device, then explains — in plain English — the exact moment behavior drifts into something dangerous.

---

## Architecture

*(Diagram coming in final phase)*

**Pipeline:**  
Log Generator → Feature Engineering → Isolation Forest (Layer 1) → XGBoost Classifier (Layer 2) → SHAP Explainability → FastAPI → Next.js Dashboard

**Hot path** (real-time): event scoring via pre-loaded models — millisecond latency  
**Cold path** (batch): drift detection, baseline refresh, periodic retraining

---

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
python app/ml/generator.py          # generate synthetic logs
# (subsequent steps added per feature)
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Full stack (Docker)

```bash
docker-compose up   # (added in deploy phase)
```

---

## Evaluation Metrics

*(Populated after model training phase)*

| Metric | Value |
|---|---|
| Anomaly layer ROC-AUC | TBD |
| Anomaly layer PR-AUC | TBD |
| Classifier PR-AUC | TBD |
| Detection latency (p50) | TBD ms |

---

*See `docs/DriftWatch_PRD.md` for full product spec.*
