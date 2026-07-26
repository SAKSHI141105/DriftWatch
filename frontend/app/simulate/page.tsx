"use client";

import React, { useState } from "react";
import Link from "next/link";
import { scoreEvent } from "../../lib/api";
import { ScoreRequest, ScoreResponse } from "../../lib/types";
import { RiskBadge } from "../../components/RiskBadge";
import { ReasonExplainer } from "../../components/ReasonExplainer";
import {
  Send,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Cpu,
  Radio,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";

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
      const res = await scoreEvent({
        ...form,
        timestamp: new Date().toISOString(),
      });
      setLatencyMs(Math.round(performance.now() - t0));
      setResult(res);
    } catch (err) {
      console.error("Scoring failed:", err);
      setError(
        "Failed to reach scoring API (POST /score). Ensure backend uvicorn is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Live Event Injection Sandbox</span>
            <Badge variant="amber" className="animate-pulse">
              HOT PATH (POST /score)
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Simulate real-time access events through Layer 1 Isolation Forest &amp; Layer 2 XGBoost. Flagged anomalies (risk &ge;40) broadcast via WebSocket.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Presets & Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Presets Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>One-Click Attack Presets</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.type}
                  onClick={() => applyPreset(p.data)}
                  className="w-full text-left p-3 rounded-lg bg-background hover:bg-accent border border-border font-mono text-xs text-foreground flex items-center justify-between group transition-all cursor-pointer"
                >
                  <span className="group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors font-semibold truncate mr-2">
                    {p.name}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[9px]">
                    {p.type.replace(/_/g, " ")}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Telemetry Form Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Event Telemetry Parameters</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  JSON Payload
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-xs">
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
                    <label className="text-muted-foreground block text-[10px] uppercase mb-1">
                      {label}
                    </label>
                    <Input
                      type="text"
                      value={String(form[field] ?? "")}
                      onChange={(e) =>
                        setForm({ ...form, [field]: e.target.value })
                      }
                    />
                  </div>
                ))}
                <div>
                  <label className="text-muted-foreground block text-[10px] uppercase mb-1">
                    Action
                  </label>
                  <select
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                    className="w-full bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-ring outline-none uppercase"
                  >
                    <option value="login">login</option>
                    <option value="read">read</option>
                    <option value="write">write</option>
                    <option value="escalate">escalate</option>
                  </select>
                </div>
              </div>

              <Button
                variant="amber"
                size="lg"
                onClick={handleScore}
                disabled={loading}
                className="w-full mt-2"
              >
                <Send className="w-4 h-4 mr-2" />
                <span>
                  {loading
                    ? "Scoring Telemetry..."
                    : "Execute Real-Time Scoring (POST /score)"}
                </span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Real-Time Inference Output */}
        <div className="lg:col-span-7">
          <Card className="h-full min-h-[460px] flex flex-col justify-between">
            <CardHeader className="border-b border-border flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-500" />
                <span>Real-Time Inference Output</span>
              </CardTitle>
              {latencyMs !== null && (
                <Badge variant="success" className="font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Scored in {latencyMs}ms</span>
                </Badge>
              )}
            </CardHeader>

            <CardContent className="flex-1 pt-6 flex flex-col justify-center">
              {error && (
                <div className="p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs font-mono">
                  {error}
                </div>
              )}

              {!result && !loading && !error && (
                <div className="text-center text-muted-foreground font-mono py-16 space-y-3">
                  <Radio className="w-10 h-10 text-muted-foreground/50 animate-pulse mx-auto" />
                  <p className="text-xs">
                    Select an attack preset or edit telemetry parameters, then execute scoring.
                  </p>
                </div>
              )}

              {loading && (
                <div className="text-center text-muted-foreground font-mono py-16 space-y-3">
                  <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
                  <p className="text-xs">
                    Executing Layer 1 IForest &amp; Layer 2 XGBoost pipeline...
                  </p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-5 font-sans">
                  {/* Classification Ribbon */}
                  <div className="p-4 rounded-xl bg-background border border-border flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                        Inference Result
                      </span>
                      <RiskBadge
                        score={result.risk_score}
                        attackType={result.attack_type}
                        size="lg"
                      />
                    </div>

                    <div className="text-right font-mono text-xs space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase">
                        Layer 1 Anomaly Score
                      </div>
                      <div className="text-amber-500 dark:text-amber-300 font-bold text-sm">
                        {(result.anomaly_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Baseline:{" "}
                        <strong className="text-foreground uppercase">
                          {result.baseline_type}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* SHAP Reason Explainer */}
                  <ReasonExplainer
                    reason={result.reason}
                    riskScore={result.risk_score}
                    attackType={result.attack_type}
                    confidence={result.confidence}
                  />

                  {/* Broadcast notice */}
                  {result.alert_id ? (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 text-amber-500 dark:text-amber-300">
                        <Radio className="w-4 h-4 animate-pulse text-amber-500" />
                        <span>
                          Alert <strong>{result.alert_id.slice(0, 8)}…</strong> broadcasted to WebSocket subscribers.
                        </span>
                      </div>
                      <Link href={`/alerts/${result.alert_id}`}>
                        <Button variant="amber" size="sm">
                          <span>Investigate</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-mono flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Risk score below threshold (&lt;40) — logged as legitimate access.</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <div className="px-5 py-3 border-t border-border bg-muted/40 text-[10px] font-mono text-muted-foreground flex justify-between items-center">
              <span>POST http://localhost:8000/api/score</span>
              <span>WebSocket broadcast: automatic</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
