"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchAlertDetail, submitFeedback } from "../../../lib/api";
import { Alert } from "../../../lib/types";
import { Navbar } from "../../../components/Navbar";
import { RiskBadge } from "../../../components/RiskBadge";
import { ReasonExplainer } from "../../../components/ReasonExplainer";
import { TimelineView } from "../../../components/TimelineView";
import {
  ArrowLeft,
  Shield,
  Clock,
  MapPin,
  Globe,
  User,
  Terminal,
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
  Lock,
} from "lucide-react";

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params?.id as string;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (!alertId) return;
    setLoading(true);
    fetchAlertDetail(alertId)
      .then((data) => {
        setAlert(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching detail:", err);
        setError("Failed to load alert detail from backend API.");
        setLoading(false);
      });
  }, [alertId]);

  const handleAction = async (action: "confirm" | "dismiss") => {
    if (!alert) return;
    try {
      setProcessing(true);
      await submitFeedback(alert.id, {
        action,
        note: note || `Analyst ${action} via full investigation view`,
      });
      setAlert({ ...alert, status: action === "confirm" ? "confirmed" : "dismissed" });
    } catch (err) {
      console.error("Feedback failed:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-slate-500 font-mono">
          Loading detailed behavioral investigation data...
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto p-8 text-center space-y-4">
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 font-mono">
            {error || "Alert not found."}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Alert Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Active Threat Queue</span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-500">INVESTIGATION ID:</span>
            <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {alert.id}
            </span>
          </div>
        </div>

        {/* Top Investigation Header */}
        <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-900 border border-slate-800 shadow-2xl flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono text-slate-100 flex items-center gap-2">
                <User className="w-6 h-6 text-amber-400" />
                <span>{alert.user_id}</span>
              </span>
              <RiskBadge score={alert.risk_score} attackType={alert.attack_type} size="lg" />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{new Date(alert.timestamp).toLocaleString()}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{alert.geo_city} ({alert.geo_lat}, {alert.geo_lon})</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>IP: {alert.source_ip}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right font-mono">
              <span className="text-[10px] uppercase text-slate-400 block">Baseline Model</span>
              <span
                className={`inline-block px-2.5 py-1 rounded text-xs border uppercase mt-1 ${
                  alert.baseline_type === "personal"
                    ? "bg-slate-800 text-slate-300 border-slate-700"
                    : "bg-amber-950/50 text-amber-300 border-amber-800"
                }`}
              >
                {alert.baseline_type} Profile {alert.cold_start ? "(Cold Start Fallback)" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Core Explainability (SHAP Plain English) */}
        <ReasonExplainer
          reason={alert.reason}
          riskScore={alert.risk_score}
          attackType={alert.attack_type}
        />

        {/* Detailed Investigation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Event Chronology & Touchpoints */}
          <div className="lg:col-span-2 space-y-6">
            <TimelineView alert={alert} />

            {/* Raw Event Parameter Telemetry */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <span>Raw Access Log Event Telemetry</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Device Fingerprint</span>
                  <span className="text-slate-200 mt-1 block font-bold">{alert.device_id}</span>
                </div>
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Resource Touched</span>
                  <span className="text-amber-300 mt-1 block font-bold truncate" title={alert.resource_accessed}>
                    {alert.resource_accessed}
                  </span>
                </div>
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Operation Action</span>
                  <span className="text-slate-200 mt-1 block uppercase font-bold">{alert.action}</span>
                </div>
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Auth Mechanism</span>
                  <span className="text-slate-200 mt-1 block font-bold uppercase">{alert.auth_method}</span>
                </div>
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Session Duration</span>
                  <span className="text-slate-200 mt-1 block font-bold">{alert.session_duration_s}s</span>
                </div>
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Data Transferred</span>
                  <span className="text-slate-200 mt-1 block font-bold">{(alert.bytes_transferred / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Analyst Feedback Loop & Retraining Control */}
          <div className="space-y-6">
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl flex flex-col justify-between h-full">
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Analyst Verification &amp; Retraining Loop</span>
                </h4>

                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Confirming an attack or dismissing a false positive writes labeled feedback directly to SQLite. This dataset feeds the scheduled <strong>ADWIN concept-drift retraining cycle</strong> to adapt user behavioral boundaries.
                </p>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-mono text-slate-400 block uppercase">
                    Investigation Notes:
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter context for SOC audit log (e.g., Verified authorized travel with user via Slack)..."
                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/60 resize-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-800/80 mt-6">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>Current Status:</span>
                  <span className="text-slate-200 uppercase font-bold">{alert.status}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAction("confirm")}
                    disabled={processing || alert.status === "confirmed"}
                    className="py-2.5 px-4 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Threat</span>
                  </button>

                  <button
                    onClick={() => handleAction("dismiss")}
                    disabled={processing || alert.status === "dismissed"}
                    className="py-2.5 px-4 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Dismiss FP</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
