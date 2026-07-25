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

export async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${API_BASE}/metrics`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch metrics');
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

    function connect() {
      try {
        ws = new WebSocket(WS_URL);
        wsRef.current = ws;

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
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch (err) {
        reconnectTimer = setTimeout(connect, 5000);
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
