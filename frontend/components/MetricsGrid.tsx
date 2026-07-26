import React from "react";
import { MetricsResponse } from "../lib/types";
import { ShieldCheck, TrendingUp, Activity, Layers } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

export function MetricsGrid({ metrics }: { metrics: MetricsResponse }) {
  const classes = Object.entries(metrics.classifier_metrics || {}).filter(
    ([k]) => k !== "normal"
  );

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ROC-AUC */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Layer 1 ROC-AUC</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-slate-100">
            {(metrics.anomaly_roc_auc * 100).toFixed(1)}%
          </div>
          <ProgressBar value={metrics.anomaly_roc_auc} />
          <p className="text-[11px] text-slate-500 font-mono">
            PR-AUC:{" "}
            <strong className="text-amber-400/90">
              {(metrics.anomaly_pr_auc * 100).toFixed(1)}%
            </strong>{" "}
            (Unsupervised IF)
          </p>
        </div>

        {/* False Positive Rate */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">False Positive Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-400">
            {(metrics.anomaly_fpr * 100).toFixed(2)}%
          </div>
          {/* For FPR, lower is better — invert the bar */}
          <ProgressBar value={1 - metrics.anomaly_fpr} />
          <p className="text-[11px] text-slate-500 font-mono">
            Cost-weighted threshold{" "}
            <strong className="text-slate-300">(&ge;40)</strong>
          </p>
        </div>

        {/* Concept Drift */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Concept Drift</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-mono font-bold">
            {metrics.drift_detected ? (
              <span className="text-amber-400">DRIFT DETECTED</span>
            ) : (
              <span className="text-emerald-400">STABLE</span>
            )}
          </div>
          <div
            className={`h-1.5 rounded-full ${
              metrics.drift_detected ? "bg-amber-500" : "bg-emerald-500/60"
            }`}
          />
          <p className="text-[11px] text-slate-500 font-mono">
            ADWIN / KS-test · {metrics.drift_users_affected} users
          </p>
        </div>

        {/* Queue Status */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Queue Status</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-slate-100">
            {metrics.open_alerts}
            <span className="text-xs font-normal text-slate-500 ml-1">OPEN</span>
          </div>
          <ProgressBar
            value={
              metrics.total_alerts > 0
                ? metrics.open_alerts / metrics.total_alerts
                : 0
            }
          />
          <p className="text-[11px] font-mono text-slate-400 flex gap-2">
            <span className="text-emerald-400">{metrics.confirmed_alerts} confirmed</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{metrics.dismissed_alerts} dismissed</span>
          </p>
        </div>
      </div>

      {/* Multi-Class XGBoost Quality */}
      <div className="rounded-xl border border-slate-800 bg-[#0f172a]/90 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Layer 2 XGBoost Multi-Class Classification Quality</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SMOTE Balanced
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Precision, Recall, and F1 evaluated across all 5 synthetic attack patterns.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {classes.map(([clsName, stats]) => (
            <div
              key={clsName}
              className="p-4 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-4"
            >
              <div
                className="text-xs font-mono font-semibold uppercase text-amber-300 tracking-wider truncate"
                title={clsName}
              >
                {clsName.replace(/_/g, " ")}
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Precision</span>
                    <span className="font-bold text-slate-200">{(stats.precision * 100).toFixed(1)}%</span>
                  </div>
                  <ProgressBar value={stats.precision} />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Recall</span>
                    <span className="font-bold text-slate-200">{(stats.recall * 100).toFixed(1)}%</span>
                  </div>
                  <ProgressBar value={stats.recall} />
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">F1 Score</span>
                    <span className="font-bold text-amber-400">{(stats.f1 * 100).toFixed(1)}%</span>
                  </div>
                  <ProgressBar value={stats.f1} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
