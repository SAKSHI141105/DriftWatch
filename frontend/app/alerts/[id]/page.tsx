"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchAlertDetail, submitFeedback } from "../../../lib/api";
import { Alert } from "../../../lib/types";
import { RiskBadge } from "../../../components/RiskBadge";
import { ReasonExplainer } from "../../../components/ReasonExplainer";
import { TimelineView } from "../../../components/TimelineView";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Globe,
  User,
  CheckCircle2,
  XCircle,
  Database,
  Lock,
  Save,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";

export default function AlertDetailPage() {
  const params = useParams();
  const alertId = params?.id as string;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [noteSaved, setNoteSaved] = useState<boolean>(false);

  useEffect(() => {
    if (!alertId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchAlertDetail(alertId);
        if (!cancelled) {
          setAlert(data);
          if (data.latest_note) {
            setNote(data.latest_note);
          } else if (data.notes && data.notes.length > 0) {
            const firstNote = data.notes.find((n) => n.note);
            if (firstNote?.note) setNote(firstNote.note);
          }
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching detail:", err);
        if (!cancelled) setError("Failed to load alert detail from backend API.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  const handleAction = async (action: "confirm" | "dismiss" | "note") => {
    if (!alert) return;
    try {
      setProcessing(true);
      setNoteSaved(false);
      const res = await submitFeedback(alert.id, {
        action,
        note: note || undefined,
      });

      if (action === "note") {
        setNoteSaved(true);
        // Refresh alert detail to load updated notes list
        const updatedAlert = await fetchAlertDetail(alert.id);
        setAlert(updatedAlert);
      } else {
        setAlert({
          ...alert,
          status: action === "confirm" ? "confirmed" : "dismissed",
        });
      }
    } catch (err) {
      console.error("Feedback failed:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono min-h-[400px]">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span>Loading investigation telemetry...</span>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4 font-mono">
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
          {error || "Alert not found."}
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Threat Queue
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb Action */}
      <div className="flex items-center justify-between font-mono text-xs">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            <span>Back to Threat Queue</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground uppercase text-[10px]">Alert ID:</span>
          <span className="text-foreground bg-muted px-2 py-0.5 rounded border border-border font-mono text-[11px] truncate max-w-xs">
            {alert.id}
          </span>
        </div>
      </div>

      {/* Investigation Top Banner Card */}
      <Card>
        <CardContent className="p-6 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
                <User className="w-6 h-6 text-amber-500" />
                <span>{alert.user_id}</span>
              </span>
              <RiskBadge score={alert.risk_score} attackType={alert.attack_type} size="lg" />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(alert.timestamp).toLocaleString()}</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{alert.geo_city} ({alert.geo_lat.toFixed(2)}, {alert.geo_lon.toFixed(2)})</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-300">
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                <span>IP: {alert.source_ip}</span>
              </span>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] uppercase text-muted-foreground block mb-1">Baseline Profile</span>
            <Badge variant={alert.baseline_type === "personal" ? "secondary" : "warning"}>
              {alert.baseline_type} Profile {alert.cold_start ? "(Cold Start)" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* SHAP Explainability */}
      <ReasonExplainer
        reason={alert.reason}
        riskScore={alert.risk_score}
        attackType={alert.attack_type}
        confidence={alert.confidence}
      />

      {/* Detailed Investigation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TimelineView alert={alert} />

          {/* Raw Event Telemetry Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500" />
                <span>Raw Telemetry &amp; Access Log Event</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                {[
                  { label: "Device Fingerprint", value: alert.device_id, highlight: false },
                  { label: "Resource Touched", value: alert.resource_accessed, highlight: true },
                  { label: "Operation", value: alert.action.toUpperCase(), highlight: false },
                  { label: "Auth Mechanism", value: alert.auth_method.toUpperCase(), highlight: false },
                  { label: "Session Duration", value: `${alert.session_duration_s}s`, highlight: false },
                  { label: "Data Transferred", value: `${(alert.bytes_transferred / 1024).toFixed(1)} KB`, highlight: false },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase">{label}</span>
                    <span className={`mt-1 block font-bold truncate ${highlight ? "text-amber-500 dark:text-amber-300" : "text-foreground"}`} title={value}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analyst Verification & Retraining Card */}
        <div>
          <Card className="h-full min-h-[360px] flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>Analyst Verification &amp; Notes</span>
                </div>
                {noteSaved && (
                  <Badge variant="success" className="text-[9px]">
                    Saved
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 flex-1">
              <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                Confirming or dismissing writes labeled feedback to SQLite, feeding the <strong className="text-foreground">ADWIN concept-drift retraining cycle</strong>.
              </p>

              {/* Notes Input Area */}
              <div className="space-y-2 pt-1 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground block uppercase text-[10px]">
                    Audit Investigation Note:
                  </label>
                  <button
                    onClick={() => handleAction("note")}
                    disabled={processing || !note.trim()}
                    className="text-[10px] text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3 h-3" /> Save Note
                  </button>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteSaved(false);
                  }}
                  placeholder="Enter context for SOC audit log (e.g. Verified authorized travel via Slack)..."
                  className="w-full h-24 bg-background border border-input rounded-lg p-3 text-xs font-mono text-foreground focus:outline-none focus:border-ring resize-none placeholder:text-muted-foreground transition-colors"
                />
              </div>

              {/* Notes History List */}
              {alert.notes && alert.notes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border font-mono text-xs">
                  <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-500" /> Note History ({alert.notes.length})
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {alert.notes.map((n, i) => (
                      <div key={i} className="p-2 rounded bg-muted/40 border border-border text-[11px]">
                        <div className="flex items-center justify-between text-muted-foreground text-[9px] mb-0.5">
                          <span className="uppercase font-semibold">{n.action}</span>
                          <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-foreground">{n.note || "(No note content)"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Current Status:</span>
                  <span className={`uppercase font-bold ${
                    alert.status === "confirmed" ? "text-emerald-500 dark:text-emerald-400" :
                    alert.status === "dismissed" ? "text-muted-foreground" : "text-amber-500 dark:text-amber-300"
                  }`}>
                    {alert.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="destructive"
                    size="default"
                    onClick={() => handleAction("confirm")}
                    disabled={processing || alert.status === "confirmed"}
                    className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25 border-emerald-500/30"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    <span>Confirm</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => handleAction("dismiss")}
                    disabled={processing || alert.status === "dismissed"}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    <span>Dismiss FP</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
