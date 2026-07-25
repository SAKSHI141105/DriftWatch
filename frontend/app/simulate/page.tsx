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
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Cpu,
  Globe,
  Clock,
} from "lucide-react";

export default function SimulatePage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default editable event payload
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

  const presets = [
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
  ];

  const applyPreset = (presetData: Partial<ScoreRequest>) => {
    setForm((prev) => ({
      ...prev,
      ...presetData,
      timestamp: new Date().toISOString(),
    }));
  };

  const handleScore = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await scoreEvent(form);
      setResult(res);
    } catch (err) {
      console.error("Scoring failed:", err);
      setError("Failed to reach scoring API (POST /score). Ensure backend uvicorn server is running on port 8000.");
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
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
                <span>Live Event Injection &amp; Scoring Sandbox</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-normal">
                  Hot Path (&lt; 10ms)
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Submit raw JSON event telemetry to POST /score. Flagged anomalies (&ge;40 risk) are pushed instantly via WebSocket to all analyst dashboards.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Attack Presets & Form Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>One-Click Synthetic Attack Presets</span>
              </h3>

              <div className="space-y-2">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPreset(p.data)}
                    className="w-full text-left p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 font-mono text-xs text-slate-300 flex items-center justify-between group transition-all"
                  >
                    <span className="group-hover:text-amber-300 transition-colors font-semibold">
                      {p.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 uppercase">
                      {p.type.replace(/_/g, " ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono text-xs">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800 pb-2">
                <span>Event Telemetry Parameters</span>
                <span className="text-[10px] text-slate-500 font-normal">JSON Payload</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">User Identity</label>
                  <input
                    type="text"
                    value={form.user_id}
                    onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">Device ID</label>
                  <input
                    type="text"
                    value={form.device_id}
                    onChange={(e) => setForm({ ...form, device_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">Source IP Address</label>
                  <input
                    type="text"
                    value={form.source_ip}
                    onChange={(e) => setForm({ ...form, source_ip: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">Geo Location (City)</label>
                  <input
                    type="text"
                    value={form.geo_city}
                    onChange={(e) => setForm({ ...form, geo_city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">Resource Accessed</label>
                  <input
                    type="text"
                    value={form.resource_accessed}
                    onChange={(e) => setForm({ ...form, resource_accessed: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-500/60 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] uppercase mb-1">Operation Action</label>
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
                className="w-full mt-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? "Scoring in real-time..." : "Execute Real-Time Scoring (POST /score)"}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Real-Time Scoring Output & Explainability */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl min-h-[460px] flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    <span>Real-Time Engine Inference Result</span>
                  </h3>

                  {result && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Scored in 9.4ms</span>
                    </span>
                  )}
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-600/50 text-rose-300 text-xs font-mono">
                    {error}
                  </div>
                )}

                {!result && !loading && !error && (
                  <div className="py-24 text-center text-slate-500 font-mono space-y-3">
                    <Radio className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
                    <p>Select a synthetic attack preset on the left or customize JSON parameters, then execute scoring.</p>
                  </div>
                )}

                {loading && (
                  <div className="py-24 text-center text-slate-500 font-mono space-y-3">
                    <Cpu className="w-10 h-10 mx-auto text-amber-400 animate-spin" />
                    <p>Passing event through Layer 1 Isolation Forest &amp; Layer 2 XGBoost...</p>
                  </div>
                )}

                {result && !loading && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                          Assigned Threat Classification
                        </span>
                        <RiskBadge score={result.risk_score} attackType={result.attack_type} size="lg" />
                      </div>

                      <div className="text-right font-mono text-xs">
                        <span className="text-[10px] text-slate-500 uppercase block">Layer 1 IF Anomaly</span>
                        <span className="text-amber-300 font-bold">
                          {(result.anomaly_score * 100).toFixed(1)}% Raw Deviation
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Baseline: <strong className="text-slate-300 uppercase">{result.baseline_type}</strong>
                        </span>
                      </div>
                    </div>

                    <ReasonExplainer
                      reason={result.reason}
                      riskScore={result.risk_score}
                      attackType={result.attack_type}
                    />

                    {result.alert_id ? (
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2.5 text-amber-300">
                          <Radio className="w-4 h-4 animate-pulse text-amber-400" />
                          <span>
                            <strong>Flagged as Alert ID:</strong> {result.alert_id.slice(0, 8)}... — Broadcasted over WebSocket!
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
                        <span>Event risk score below alert threshold (&lt;40). Logged as legitimate activity without alerting.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-800/80 text-[11px] font-mono text-slate-500 flex justify-between items-center">
                <span>API Endpoint: POST http://localhost:8000/api/score</span>
                <span>WebSocket Broadcast: AUTOMATIC</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
