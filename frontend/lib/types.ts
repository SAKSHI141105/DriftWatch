export interface AlertSummary {
  id: string;
  timestamp: string;
  user_id: string;
  geo_city: string;
  resource_accessed: string;
  action: string;
  risk_score: number;
  attack_type: string;
  confidence: number;
  reason: string;
  baseline_type: 'personal' | 'population' | string;
  status: 'open' | 'confirmed' | 'dismissed' | string;
}

export interface FeedbackRecord {
  id?: number;
  alert_id: string;
  action: string;
  note?: string;
  created_at: string;
}

export interface Alert extends AlertSummary {
  event_id: string;
  device_id: string;
  source_ip: string;
  geo_lat: number;
  geo_lon: number;
  auth_method: string;
  session_duration_s: number;
  bytes_transferred: number;
  success: boolean;
  anomaly_score: number;
  cold_start: boolean;
  true_label?: string;
  role?: string;
  notes?: FeedbackRecord[];
  latest_note?: string;
}

export interface AlertsResponse {
  alerts: AlertSummary[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PerClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  pr_auc: number;
  support: number;
}

export interface MetricsResponse {
  anomaly_roc_auc: number;
  anomaly_pr_auc: number;
  anomaly_fpr: number;
  classifier_metrics: Record<string, PerClassMetrics>;
  total_alerts: number;
  open_alerts: number;
  confirmed_alerts: number;
  dismissed_alerts: number;
  drift_detected: boolean;
  drift_users_affected: number;
  drift_checked_at?: string;
  cold_start_users: number;
}

export interface FeedbackRequest {
  action: 'confirm' | 'dismiss' | 'note';
  note?: string;
}

export interface ScoreRequest {
  event_id?: string;
  timestamp: string;
  user_id: string;
  device_id: string;
  source_ip: string;
  geo_city: string;
  geo_lat: number;
  geo_lon: number;
  resource_accessed: string;
  action: string;
  auth_method: string;
  session_duration_s: number;
  bytes_transferred: number;
  success: boolean;
  role?: string;
}

export interface ScoreResponse {
  event_id: string;
  risk_score: number;
  attack_type: string;
  confidence: number;
  anomaly_score: number;
  reason: string;
  baseline_type: string;
  alert_id?: string;
}
