"use client";

import React, { useEffect, useState } from "react";
import { fetchDriftDetails } from "../../lib/api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export default function DriftPage() {
  const [driftData, setDriftData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDriftDetails();
      setDriftData(data);
    } catch (err) {
      console.error("Failed to load drift data:", err);
      setError("Unable to connect to DriftWatch API backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Concept Drift &amp; Feature Shift Analysis</span>
            <Badge variant="amber">ADWIN + KS-Test</Badge>
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Real-time Kolmogorov-Smirnov 2-sample distribution shift detection across 12 behavioral features.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="font-mono shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${
              loading ? "animate-spin text-amber-500" : ""
            }`}
          />
          <span>Re-evaluate Drift</span>
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-mono">
          {error}
        </div>
      )}

      {loading && !driftData ? (
        <div className="p-16 text-center text-muted-foreground font-mono bg-card rounded-xl border border-border flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span>Computing Kolmogorov-Smirnov statistics across sliding windows...</span>
        </div>
      ) : driftData ? (
        <div className="space-y-6">
          {/* Top Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">
                  Global Drift Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      driftData.global_drift_detected
                        ? "bg-rose-500 animate-ping"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span
                    className={`text-xl font-bold font-mono ${
                      driftData.global_drift_detected
                        ? "text-rose-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {driftData.global_drift_detected
                      ? "DRIFT DETECTED"
                      : "BASELINE STABLE"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  Checked {new Date(driftData.checked_at).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">
                  ADWIN Window Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {driftData.adwin_window_size} <span className="text-xs font-normal text-muted-foreground">events</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  Confidence Threshold ($\delta$ = {driftData.confidence_threshold})
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-muted-foreground">
                  Users Shifted to Personal Baseline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-amber-500">
                  {driftData.users_drifted} <span className="text-xs font-normal text-muted-foreground">users</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  Exited cold-start phase (&gt;50 logs)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature-by-Feature KS-Test Table */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  <span>Kolmogorov-Smirnov Feature Distribution Shift Table</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  $H_0$: Baseline Distribution = Recent Window Distribution
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs divide-y divide-border">
                  <thead>
                    <tr className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
                      <th className="py-2.5 px-4">Behavioral Feature</th>
                      <th className="py-2.5 px-4">KS Statistic ($D$)</th>
                      <th className="py-2.5 px-4">$p$-value</th>
                      <th className="py-2.5 px-4">Baseline Mean ($\mu_0$)</th>
                      <th className="py-2.5 px-4">Recent Window ($\mu_1$)</th>
                      <th className="py-2.5 px-4 text-right">Drift Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driftData.feature_metrics.map((item: any) => (
                      <tr key={item.feature} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground">{item.feature}</td>
                        <td className="py-3 px-4 text-amber-500">{item.ks_stat.toFixed(3)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{item.p_value.toFixed(3)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{item.baseline_mean}</td>
                        <td className="py-3 px-4 text-foreground">{item.recent_mean}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge
                            variant={
                              item.status === "DRIFTING"
                                ? "destructive"
                                : item.status === "MONITOR"
                                ? "amber"
                                : "secondary"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
