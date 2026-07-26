"use client";

import React, { useEffect, useState } from "react";
import { fetchMetrics, refreshTelemetryBatch } from "../../lib/api";
import { MetricsResponse } from "../../lib/types";
import { MetricsGrid } from "../../components/MetricsGrid";
import { RefreshCw, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchMetrics(false);
        if (!cancelled) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        if (!cancelled)
          setError(
            "Failed to connect to backend ML metrics service (http://localhost:8000/api/metrics)."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      setRefreshNotice(null);
      const batchRes = await refreshTelemetryBatch();
      setMetrics(batchRes.metrics);
      setRefreshNotice(
        `Generated ${batchRes.events_generated} events (${batchRes.alerts_created} new alerts scored & inserted into SQLite in ${batchRes.elapsed_ms}ms)`
      );
    } catch (err) {
      console.error("Failed to refresh telemetry batch:", err);
      setError(
        "Failed to connect to backend ML metrics service (http://localhost:8000/api/metrics)."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Model Evaluation &amp; Performance Telemetry</span>
            <Badge variant="secondary">PRD §3 Verified</Badge>
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Live benchmarks for Layer 1 Isolation Forest &amp; Layer 2 XGBoost (SMOTE) evaluated on held-out test data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {refreshNotice && (
            <Badge variant="success" className="font-mono flex items-center gap-1 text-[11px] py-1 px-2.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{refreshNotice}</span>
            </Badge>
          )}

          <Button
            variant="amber"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="font-mono shrink-0"
          >
            <Zap className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : "animate-pulse"}`} />
            <span>{loading ? "Generating Batch..." : "Refresh Telemetry (Inject Batch)"}</span>
          </Button>
        </div>
      </div>

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

      {loading && !metrics ? (
        <div className="p-16 text-center text-muted-foreground font-mono bg-card rounded-xl border border-border flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span>Loading ML evaluation metrics &amp; ADWIN concept drift status...</span>
        </div>
      ) : metrics ? (
        <MetricsGrid metrics={metrics} />
      ) : null}
    </div>
  );
}
