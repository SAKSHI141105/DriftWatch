"use client";

import React, { useState } from "react";
import Link from "next/link";
import { scoreEvent } from "../../lib/api";
import { ScoreRequest, ScoreResponse } from "../../lib/types";
import { Navbar } from "../../components/Navbar";
import { RiskBadge } from "../../components/RiskBadge";
import { ReasonExplainer } from "../../components/ReasonExplainer";
import {
  Terminal,
  Radio,
  Send,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Cpu,
} from "lucide-react";

const PRESETS = [
  {
    name: "Impossible Travel (Oslo → Tokyo in 42 mins)",
    type: "impossible_travel",
    data: {
      user_id: "user_0000",
      device_id: "dev_83a19f2",
      source_ip: "152.165.21.4",
      geo_city: "Tokyo",
      geo_lat: 35.6762,
      geo_lon: 139.6503,
      resource_accessed: "hr-payroll-db",
      action: "login",
      auth_method: "password",
      session_duration_s: 120,
      bytes_transferred: 5000,
      success: true,
    },
  },
  {
    name: "Brute Force Attack (15 failed logins in 2m)",
    type: "brute_force",
    data: {
      user_id: "user_0018",
      device_id: "dev_bot_net_01",
      source_ip: "21.137.237.131",
      geo_city: "Bucharest",
      geo_lat: 44.4268,
      geo_lon: 26.1025,
      resource_accessed: "vpn-gateway",
      action: "login",
      auth_method: "password",
      session_duration_s: 5,
      bytes_transferred: 500,
      success: false,
    },
  },
  {
    name: "Lateral Movement (6 distinct resources touched)",
    type: "lateral_movement",
    data: {
      user_id: "user_0005",
      device_id: "dev_reg_22",
      source_ip: "10.0.4.19",
      geo_city: "New York",
      geo_lat: 40.7128,
      geo_lon: -74.006,
      resource_accessed: "security-audit-log",
      action: "read",
      auth_method: "sso",
      session_duration_s: 900,
      bytes_transferred: 10485760,
      success: true,
    },
  },
  {
    name: "Credential Misuse (Unseen device off-hours)",
    type: "credential_misuse",
    data: {
      user_id: "user_0001",
      device_id: "52ced2f3_spoofed",
      source_ip: "29.190.179.104",
      geo_city: "Moscow",
      geo_lat: 55.7558,
      geo_lon: 37.6173,
      resource_accessed: "customer-pii-table",
      action: "write",
      auth_method: "password",
      session_duration_s: 1800,
      bytes_transferred: 500000,
      success: true,
    },
  },
  {
    name: "Legitimate Normal Employee Access (Clean)",
    type: "normal",
    data: {
      user_id: "user_0000",
      device_id: "dev_trusted_home_01",
      source_ip: "84.215.12.9",
      geo_city: "Oslo",
      geo_lat: 59.9139,
      geo_lon: 10.7522,
      resource_accessed: "internal-jira-wiki",
      action: "read",
      auth_method: "mfa",
      session_duration_s: 7200,
      bytes_transferred: 120000,
      success: true,
    },
  },
] as const;

export default function SimulatePage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const [form, setForm] = useState<ScoreRequest>({
    timestamp: new Date().toISOString(),
    user_id: "user_0001",
    device_id: "dev_unknown_99",
    source_ip: "195.229.156.74",
    geo_city: "Tokyo",
    geo_lat: 35.6762,
    geo_lon: 139.6503,
    resource_accessed: "prod-aws-vault",
    action: "login",
    auth_method: "password",
    session_duration_s: 3600,
    bytes_transferred: 450000,
    success: true,
    role: "standard",
  });

  const applyPreset = (presetData: Partial<ScoreRequest>) => {
    setForm((prev) => ({
      ...prev,
      ...presetData,
      timestamp: new Date().toISOString(),
    }));
    setResult(null);
    setError(null);
    setLatencyMs(null);
  };

  const handleScore = async () => {
    try {
      setLoading(true);
      setError(null);
      const t0 = performance.now();
      const res = await scoreEvent({ ...form, timestamp: new Date().toISOString() });
      setLatencyMs(Math.round(performance.now() - t0));
      setResult(res);
    } catch (err) {
      console.error("Scoring failed:", err);
      setError(
        "Failed to reach scoring API (POST /score). Ensure the backend uvicorn server is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
                <span>Live Event Injection &amp; Scoring Sandbox</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-normal">
                  Hot Path
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                POST /score · Anomalies (&ge;40 risk) broadcast via WebSocket in real-time.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Presets + Form */}
          <div className="lg:col-span-5 space-y-6">
            {/* Presets */}
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>One-Click Attack Presets</span>
              </h3>
              <div className="space-y-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.type}
                    onClick={() => applyPreset(p.data)}
                    className="w-full text-left p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 font-mono text-xs text-slate-300 flex items-center justify-between group transition-all"
                  >
                    <span className="group-hover:text-amber-300 transition-colors font-semibold truncate mr-2">
                      {p.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 uppercase shrink-0">
                      {p.type.replace(/_/g, " ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono text-xs">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800 pb-2">
                <span>Event Telemetry Parameters</span>
                <span className="text-[10px] text-slate-500 font-normal">JSON Payload</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { label: "User Identity", field: "user_id" },
                    { label: "Device ID", field: "device_id" },
                    { label: "Source IP", field: "source_ip" },
                    { label: "City", field: "geo_city" },
                    { label: "Resource", field: "resource_accessed" },
                  ] as { label: string; field: keyof ScoreRequest }[]
                ).map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-slate-400 block text-[10px] uppercase mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={String(form[field] ?? "")}
                      onChange={(e) =>
                        setForm({ ...form, [field]: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">
                    Action
                  </label>
                  <select
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none uppercase"
                  >
                    <option value="login">login</option>
                    <option value="read">read</option>
                    <option value="write">write</option>
                    <option value="escalate">escalate</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleScore}
                disabled={loading}
                className="w-full mt-2 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>
                  {loading ? "Scoring…" : "Execute Real-Time Scoring (POST /score)"}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Output */}
          <div className="lg:col-span-7">
            <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl min-h-[460px] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
                <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <span>Real-Time Inference Result</span>
                </h3>

                {latencyMs !== null && (
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Scored in {latencyMs}ms</span>
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col">
                {error && (
                  <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-600/50 text-rose-300 text-xs font-mono mb-4">
                    {error}
                  </div>
                )}

                {!result && !loading && !error && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-center py-16">
                    <Radio className="w-10 h-10 text-slate-700 animate-pulse" />
                    <p className="text-sm">
                      Select a preset or fill parameters, then execute scoring.
                    </p>
                  </div>
                )}

                {loading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-center py-16">
                    <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
                    <p className="text-sm">
                      Passing through Layer 1 IForest &amp; Layer 2 XGBoost…
                    </p>
                  </div>
                )}

                {result && !loading && (
                  <div className="space-y-5">
                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                          Classification
                        </span>
                        <RiskBadge
                          score={result.risk_score}
                          attackType={result.attack_type}
                          size="lg"
                        />
                      </div>

                      <div className="text-right font-mono text-xs space-y-1">
                        <div className="text-[10px] text-slate-500 uppercase">
                          Layer 1 IF Anomaly Score
                        </div>
                        <div className="text-amber-300 font-bold">
                          {(result.anomaly_score * 100).toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Baseline:{" "}
                          <strong className="text-slate-300 uppercase">
                            {result.baseline_type}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <ReasonExplainer
                      reason={result.reason}
                      riskScore={result.risk_score}
                      attackType={result.attack_type}
                      confidence={result.confidence}
                    />

                    {result.alert_id ? (
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2.5 text-amber-300">
                          <Radio className="w-4 h-4 animate-pulse text-amber-400" />
                          <span>
                            Alert{" "}
                            <strong>{result.alert_id.slice(0, 8)}…</strong>{" "}
                            broadcasted to all dashboards.
                          </span>
                        </div>
                        <Link
                          href={`/alerts/${result.alert_id}`}
                          className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                        >
                          <span>Investigate</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs font-mono flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          Risk below threshold (&lt;40) — logged as legitimate, no alert raised.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-5 text-[11px] font-mono text-slate-500 flex justify-between items-center">
                <span>POST http://localhost:8000/api/score</span>
                <span>WS broadcast: automatic</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
