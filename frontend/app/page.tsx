"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAlerts, useAlertStream } from "../lib/api";
import { AlertSummary } from "../lib/types";
import { Navbar } from "../components/Navbar";
import { AlertTable } from "../components/AlertTable";
import { Shield, Radio, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(true);

  // Initial load from REST API — async logic lives fully inside effect
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchAlerts({ limit: 50, status: "open" });
        if (!cancelled) setAlerts(res.alerts);
      } catch (err) {
        console.error("Failed to load alerts:", err);
        if (!cancelled) {
          setError(
            "Unable to connect to DriftWatch API backend (http://localhost:8000). Please ensure uvicorn is running."
          );
          setWsConnected(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAlerts({ limit: 50, status: "open" });
      setAlerts(res.alerts);
    } catch (err) {
      console.error("Failed to reload alerts:", err);
      setError(
        "Unable to connect to DriftWatch API backend (http://localhost:8000). Please ensure uvicorn is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // Connect to live WebSocket stream for real-time alert pushes
  useAlertStream(
    (newAlert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
      setWsConnected(true);
    },
    (initAlerts) => {
      setWsConnected(true);
      // Use functional update to read latest state — avoids stale closure
      setAlerts((prev) => {
        if (prev.length === 0 && initAlerts.length > 0) return initAlerts;
        return prev;
      });
    }
  );

  const handleStatusChange = (alertId: string, newStatus: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
  };

  const openCount = alerts.filter((a) => a.status === "open").length;
  const criticalCount = alerts.filter((a) => a.risk_score >= 80 && a.status === "open").length;

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col font-sans">
      <Navbar wsConnected={wsConnected} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* SOC Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
                <span>Real-Time Behavioral Threat Queue</span>
                {criticalCount > 0 && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500 font-semibold animate-pulse">
                    {criticalCount} CRITICAL
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Flagged by Layer 1 (IForest) &amp; attributed by Layer 2 (XGBoost).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
              <span>Refresh Queue</span>
            </button>

            <Link
              href="/simulate"
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Inject Synthetic Attack</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-sm flex items-center justify-between font-mono">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Queue Stats Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-slate-400 uppercase">Total Open Alerts</div>
            <div className="text-2xl font-mono font-bold text-slate-100 mt-1">{openCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-slate-400 uppercase">Critical (&ge;80)</div>
            <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{criticalCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-slate-400 uppercase">Detection Engine</div>
            <div className="text-sm font-mono font-semibold text-emerald-400 mt-2">2-Stage Active</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-slate-400 uppercase">Hot Path Latency</div>
            <div className="text-sm font-mono font-semibold text-slate-300 mt-2">&lt; 10.0 ms</div>
          </div>
        </div>

        {/* Main Queue Table */}
        {loading && alerts.length === 0 ? (
          <div className="p-16 text-center text-slate-500 font-mono bg-slate-900/40 rounded-xl border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-400" />
            Loading behavioral alerts from database...
          </div>
        ) : (
          <AlertTable alerts={alerts} onStatusChange={handleStatusChange} />
        )}
      </main>
    </div>
  );
}
