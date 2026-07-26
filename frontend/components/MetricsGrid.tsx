import React from "react";
import { MetricsResponse } from "../lib/types";
import { ShieldCheck, TrendingUp, Activity, Layers, Target, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";

export function MetricsGrid({ metrics }: { metrics: MetricsResponse }) {
  const classes = Object.entries(metrics.classifier_metrics || {}).filter(
    ([k]) => k !== "normal"
  );

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "text-emerald-500";
    if (score >= 0.8) return "text-amber-500";
    if (score >= 0.7) return "text-orange-500";
    return "text-rose-500";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.9) return { label: "Excellent", variant: "success" as const };
    if (score >= 0.8) return { label: "Good", variant: "amber" as const };
    if (score >= 0.7) return { label: "Fair", variant: "warning" as const };
    return { label: "Poor", variant: "destructive" as const };
  };

  return (
    <div className="space-y-8">
      {/* Top KPI Cards - Clean Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ROC-AUC */}
        <Card className="border-border/50 hover:border-amber-500/30 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-col items-center text-center space-y-2 pb-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-amber-500" />
            </div>
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Layer 1 ROC-AUC
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div className="text-4xl font-mono font-bold text-foreground">
              {(metrics.anomaly_roc_auc * 100).toFixed(1)}<span className="text-lg text-muted-foreground">%</span>
            </div>
            <Badge variant={getScoreBadge(metrics.anomaly_roc_auc).variant} className="font-mono">
              {getScoreBadge(metrics.anomaly_roc_auc).label}
            </Badge>
            <p className="text-[11px] text-muted-foreground font-mono">
              PR-AUC: <span className="text-foreground font-semibold">{(metrics.anomaly_pr_auc * 100).toFixed(1)}%</span>
            </p>
          </CardContent>
        </Card>

        {/* False Positive Rate */}
        <Card className="border-border/50 hover:border-emerald-500/30 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-col items-center text-center space-y-2 pb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              False Positive Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div className="text-4xl font-mono font-bold text-emerald-500">
              {(metrics.anomaly_fpr * 100).toFixed(2)}<span className="text-lg text-muted-foreground">%</span>
            </div>
            <Badge variant="success" className="font-mono">
              Low Risk
            </Badge>
            <p className="text-[11px] text-muted-foreground font-mono">
              Threshold: <span className="text-foreground font-semibold">&ge;40</span>
            </p>
          </CardContent>
        </Card>

        {/* Concept Drift */}
        <Card className="border-border/50 hover:border-amber-500/30 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-col items-center text-center space-y-2 pb-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-500" />
            </div>
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Concept Drift
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div className="text-2xl font-mono font-bold">
              {metrics.drift_detected ? (
                <span className="text-amber-500">DETECTED</span>
              ) : (
                <span className="text-emerald-500">STABLE</span>
              )}
            </div>
            <Badge variant={metrics.drift_detected ? "destructive" : "success"} className="font-mono">
              {metrics.drift_detected ? "Action Required" : "Healthy"}
            </Badge>
            <p className="text-[11px] text-muted-foreground font-mono">
              {metrics.drift_users_affected} users affected
            </p>
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card className="border-border/50 hover:border-amber-500/30 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-col items-center text-center space-y-2 pb-4">
            <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center">
              <Layers className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Alert Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div className="text-4xl font-mono font-bold text-foreground">
              {metrics.open_alerts}
            </div>
            <Badge variant="amber" className="font-mono">
              Open
            </Badge>
            <p className="text-[11px] text-muted-foreground font-mono">
              <span className="text-emerald-500">{metrics.confirmed_alerts}</span> confirmed · <span>{metrics.dismissed_alerts}</span> dismissed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Class XGBoost Quality - Table Design */}
      <Card className="border-border/50">
        <CardHeader className="border-b border-border/50 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2.5">
                <Target className="w-5 h-5 text-amber-500" />
                <span>Layer 2 XGBoost Classification Quality</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                Performance metrics across 5 synthetic attack patterns (SMOTE balanced)
              </p>
            </div>
            <Badge variant="amber" className="font-mono self-start">
              <Zap className="w-3 h-3 mr-1" />
              SMOTE Balanced
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-xs font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                    Attack Type
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                    Precision
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                    Recall
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                    F1 Score
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {classes.map(([clsName, stats], idx) => (
                  <tr
                    key={clsName}
                    className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? "bg-muted/10" : ""
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {clsName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className={`font-mono text-lg font-bold ${getScoreColor(stats.precision)}`}>
                        {(stats.precision * 100).toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className={`font-mono text-lg font-bold ${getScoreColor(stats.recall)}`}>
                        {(stats.recall * 100).toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className={`font-mono text-lg font-bold ${getScoreColor(stats.f1)}`}>
                        {(stats.f1 * 100).toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant={getScoreBadge(stats.f1).variant} className="font-mono text-[10px]">
                        {getScoreBadge(stats.f1).label}
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
  );
}
