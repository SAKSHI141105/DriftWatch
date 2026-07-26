"use client";

import React, { useEffect, useState } from "react";
import { fetchMetrics } from "../../lib/api";
import { MetricsResponse } from "../../lib/types";
import { Navbar } from "../../components/Navbar";
import { MetricsGrid } from "../../components/MetricsGrid";
import { RefreshCw, BarChart3, AlertTriangle } from "lucide-react";

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fix: all async logic inside effect body with cancel-token
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchMetrics();
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
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      setError("Failed to connect to backend ML metrics service (http://localhost:8000/api/metrics).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
                <span>Model Evaluation &amp; Drift Telemetry</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-normal">
                  PRD §3 Verified
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Live benchmarks: Layer 1 (IForest) &amp; Layer 2 (XGBoost + SMOTE) on held-out test data.
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

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
              Retry
            </button>
          </div>
        )}

        {loading && !metrics ? (
          <div className="p-16 text-center text-slate-500 font-mono bg-slate-900/40 rounded-xl border border-slate-800 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
            <span>Loading model evaluation metrics and ADWIN drift status...</span>
          </div>
        ) : metrics ? (
          <MetricsGrid metrics={metrics} />
        ) : null}
      </main>
    </div>
  );
}
