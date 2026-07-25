import React from "react";
import { MetricsResponse } from "../lib/types";
import { ShieldCheck, TrendingUp, AlertTriangle, Cpu, Activity, Layers } from "lucide-react";

export function MetricsGrid({ metrics }: { metrics: MetricsResponse }) {
  const classes = Object.entries(metrics.classifier_metrics || {}).filter(([k]) => k !== "normal");

  return (
    <div className="space-y-6">
      {/* Top Level KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Layer 1 Anomaly ROC-AUC</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-slate-100">
            {(metrics.anomaly_roc_auc * 100).toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            PR-AUC: <strong className="text-amber-400/90">{(metrics.anomaly_pr_auc * 100).toFixed(1)}%</strong> (Unsupervised IF)
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">False Positive Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-400">
            {(metrics.anomaly_fpr * 100).toFixed(2)}%
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Cost-weighted threshold <strong className="text-slate-300">(&ge;40)</strong>
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Concept Drift Monitor</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100 flex items-center gap-2">
            {metrics.drift_detected ? (
              <span className="text-amber-400">DRIFT DETECTED</span>
            ) : (
              <span className="text-emerald-400">STABLE</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            ADWIN / KS-test across {metrics.drift_users_affected} users
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Queue Action Status</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">
            {metrics.open_alerts} <span className="text-xs font-normal text-slate-500">OPEN</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-1 flex gap-2">
            <span className="text-emerald-400">{metrics.confirmed_alerts} confirmed</span>
            <span>•</span>
            <span className="text-slate-500">{metrics.dismissed_alerts} dismissed</span>
          </p>
        </div>
      </div>

      {/* Multi-Class XGBoost Performance Breakdown */}
      <div className="rounded-xl border border-slate-800 bg-[#0f172a]/90 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Layer 2 XGBoost Multi-Class Classification Quality</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SMOTE Balanced
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Precision, Recall, and F1 score evaluated across all 5 synthetic attack patterns.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {classes.map(([clsName, stats]) => (
            <div
              key={clsName}
              className="p-4 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
            >
              <div className="text-xs font-mono font-semibold uppercase text-amber-300 tracking-wider mb-3 truncate" title={clsName}>
                {clsName.replace(/_/g, " ")}
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Precision:</span>
                  <span className="font-bold text-slate-200">{(stats.precision * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recall:</span>
                  <span className="font-bold text-slate-200">{(stats.recall * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1">
                  <span className="text-slate-400">F1 Score:</span>
                  <span className="font-bold text-amber-400">{(stats.f1 * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
