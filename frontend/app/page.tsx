"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAlerts, fetchMetrics, refreshTelemetryBatch, useAlertStream } from "../lib/api";
import { AlertSummary, MetricsResponse } from "../lib/types";
import { AlertTable } from "../components/AlertTable";
import {
  Shield,
  Radio,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Activity,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("queue");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [alertsRes, metricsRes] = await Promise.all([
        fetchAlerts({ limit: 100 }),
        fetchMetrics(true),
      ]);
      setAlerts(alertsRes.alerts);
      setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(
        "Unable to connect to DriftWatch API backend (http://localhost:8000). Please ensure uvicorn is running."
      );
      setWsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      await refreshTelemetryBatch();
      const [alertsRes, metricsRes] = await Promise.all([
        fetchAlerts({ limit: 100 }),
        fetchMetrics(true),
      ]);
      setAlerts(alertsRes.alerts);
      setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to refresh dashboard data:", err);
      setError(
        "Unable to connect to DriftWatch API backend (http://localhost:8000). Please ensure uvicorn is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useAlertStream(
    (newAlert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
      setWsConnected(true);
      fetchMetrics().then(setMetrics).catch(() => {});
    },
    (initAlerts) => {
      setWsConnected(true);
      setAlerts((prev) => {
        if (prev.length === 0 && initAlerts.length > 0) return initAlerts;
        return prev;
      });
      fetchMetrics().then(setMetrics).catch(() => {});
    }
  );

  const handleStatusChange = (alertId: string, newStatus: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
    // Refresh database counts to update KPI cards immediately
    fetchMetrics().then(setMetrics).catch(() => {});
  };

  const openCount = metrics ? metrics.open_alerts : alerts.filter((a) => a.status === "open").length;
  const confirmedCount = metrics ? metrics.confirmed_alerts : alerts.filter((a) => a.status === "confirmed").length;
  const dismissedCount = metrics ? metrics.dismissed_alerts : alerts.filter((a) => a.status === "dismissed").length;
  const criticalCount = alerts.filter(
    (a) => a.risk_score >= 80 && a.status === "open"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Page Header (shadcn-admin style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Behavioral Threat Queue</span>
            {criticalCount > 0 && (
              <Badge variant="amber" className="animate-pulse">
                {criticalCount} CRITICAL
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Real-time behavioral anomalies flagged by Layer 1 Isolation Forest &amp; classified by Layer 2 XGBoost.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 font-mono">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${
                loading ? "animate-spin text-amber-500" : ""
              }`}
            />
            <span>Refresh</span>
          </Button>

          <Link href="/simulate">
            <Button variant="amber" size="sm">
              <Zap className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
              <span>Inject Synthetic Attack</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Overview Stat Cards Grid (shadcn-admin KPI cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Open Alerts */}
        <Card className="hover:border-ring transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Total Open Alerts
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Shield className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {openCount}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-1 flex items-center gap-1">
              <span className="text-amber-500 font-medium">{confirmedCount} confirmed</span>
              <span>·</span>
              <span>{dismissedCount} dismissed</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Critical Threats */}
        <Card className="hover:border-ring transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Critical (&ge;80 Risk)
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-500 dark:text-amber-400">
              {criticalCount}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              High-priority SOC verification
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Detection Engine */}
        <Card className="hover:border-ring transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Detection Engine
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Activity className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              2-Stage Active Pipeline
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              IForest + XGBoost + SMOTE
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Hot Path Latency */}
        <Card className="hover:border-ring transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Inference Latency
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
              <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              &lt; 10.0 <span className="text-xs text-muted-foreground font-normal">ms</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              POST /score real-time hot path
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabbed Interface */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 border-b border-border font-mono text-xs pb-1">
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
              activeTab === "queue"
                ? "bg-accent text-amber-500 dark:text-amber-400 border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Threat Queue ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab("critical")}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
              activeTab === "critical"
                ? "bg-accent text-amber-500 dark:text-amber-400 border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Critical Only ({criticalCount})
          </button>
        </div>

        {/* Tab Content: Alert Table */}
        {loading && alerts.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground font-mono bg-card rounded-xl border border-border">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
            Fetching behavioral alerts from SQLite database...
          </div>
        ) : (
          <AlertTable
            alerts={
              activeTab === "critical"
                ? alerts.filter((a) => a.risk_score >= 80)
                : alerts
            }
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}
