import { useEffect, useRef } from 'react';
import {
  Alert,
  AlertsResponse,
  AlertSummary,
  FeedbackRequest,
  MetricsResponse,
  ScoreRequest,
  ScoreResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/alerts';

export async function fetchAlerts(params: {
  page?: number;
  limit?: number;
  attack_type?: string;
  status?: string;
  min_risk?: number;
}): Promise<AlertsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.attack_type) query.append('attack_type', params.attack_type);
  if (params.status) query.append('status', params.status);
  if (params.min_risk !== undefined && params.min_risk > 0)
    query.append('min_risk', params.min_risk.toString());

  const res = await fetch(`${API_BASE}/alerts?${query.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchAlertDetail(alertId: string): Promise<Alert> {
  const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch alert detail');
  return res.json();
}

export async function fetchMetrics(refresh: boolean = false): Promise<MetricsResponse> {
  const url = refresh ? `${API_BASE}/metrics?refresh=true` : `${API_BASE}/metrics`;
  const res = await fetch(url, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function refreshTelemetryBatch(): Promise<{
  status: string;
  events_generated: number;
  alerts_created: number;
  elapsed_ms: number;
  metrics: MetricsResponse;
}> {
  const res = await fetch(`${API_BASE}/telemetry/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to refresh telemetry batch');
  return res.json();
}

export async function fetchDriftDetails(): Promise<{
  global_drift_detected: boolean;
  users_drifted: number;
  checked_at: string;
  adwin_window_size: number;
  confidence_threshold: number;
  feature_metrics: Array<{
    feature: string;
    ks_stat: number;
    p_value: number;
    baseline_mean: string;
    recent_mean: string;
    status: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/drift`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch drift details');
  return res.json();
}

export async function fetchRetrainingDetails(): Promise<{
  total_feedback_labels: number;
  confirmed_threats: number;
  dismissed_fps: number;
  analyst_notes_logged: number;
  pending_retrain_batch: number;
  retrain_trigger_threshold: number;
  versions: Array<{
    version: string;
    trained_at: string;
    samples: number;
    smote_ratio: string;
    roc_auc: number;
    f1_score: number;
    status: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/retraining`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch retraining details');
  return res.json();
}

export async function submitFeedback(
  alertId: string,
  request: FeedbackRequest
): Promise<{ status: string; alert_id: string; new_status: string }> {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
  return res.json();
}

export async function scoreEvent(payload: ScoreRequest): Promise<ScoreResponse> {
  const res = await fetch(`${API_BASE}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to score event');
  return res.json();
}

export function useAlertStream(
  onNewAlert: (alert: AlertSummary) => void,
  onInit?: (alerts: AlertSummary[]) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onNewAlert);
  const initCallbackRef = useRef(onInit);

  useEffect(() => {
    callbackRef.current = onNewAlert;
    initCallbackRef.current = onInit;
  }, [onNewAlert, onInit]);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;
    let reconnectDelay = 1000; // Start at 1s, exponential backoff to 30s max

    function connect() {
      try {
        ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectDelay = 1000; // Reset backoff on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'INIT' && initCallbackRef.current) {
              initCallbackRef.current(parsed.data);
            } else if (parsed.type === 'NEW_ALERT') {
              callbackRef.current(parsed.data);
            }
          } catch (e) {
            console.error('WS parse error:', e);
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Cap at 30s
        };

        ws.onerror = () => {
          // onclose will fire after onerror, triggering reconnect
        };
      } catch {
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
}
