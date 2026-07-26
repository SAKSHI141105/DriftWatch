"use client";

import React, { useState } from "react";
import { Zap, Shield, Sliders, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export default function RulesPage() {
  const [rules, setRules] = useState([
    {
      id: "rule_1",
      name: "Impossible Travel Threshold",
      type: "impossible_travel",
      description: "Flag events where geographical velocity between consecutive logins exceeds 800 km/h.",
      enabled: true,
      threshold: 800,
      unit: "km/h",
      action: "Flag & Score Risk >= 80",
    },
    {
      id: "rule_2",
      name: "Rapid Brute Force Lockout",
      type: "brute_force",
      description: "Trigger critical alert if >10 failed authentication attempts occur within a 2-minute sliding window.",
      enabled: true,
      threshold: 10,
      unit: "failures / 2 min",
      action: "Flag & Score Risk >= 85",
    },
    {
      id: "rule_3",
      name: "Off-Hours Login Anomaly",
      type: "credential_misuse",
      description: "Identify access occurring outside user's Gaussian profile (+- 3.5 std dev).",
      enabled: true,
      threshold: 3.5,
      unit: "std dev (σ)",
      action: "Flag & Score Risk >= 70",
    },
    {
      id: "rule_4",
      name: "Cold-Start Personal Baseline Transition",
      type: "cold_start",
      description: "Automatically shift user from Population baseline to Personal profile after 50 logged events.",
      enabled: true,
      threshold: 50,
      unit: "logged events",
      action: "Shift Baseline Mode",
    },
  ]);

  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const updateThreshold = (id: string, val: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, threshold: val } : r))
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Detection Guardrails &amp; Rule Engine</span>
            <Badge variant="amber">Active Policy</Badge>
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Configure sensitivity thresholds and detection rules applied alongside Layer 1 &amp; Layer 2 ML models.
          </p>
        </div>

        {savedNotice && (
          <Badge variant="success" className="font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Policy Rules Updated Live</span>
          </Badge>
        )}
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} className="flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span>{rule.name}</span>
                </div>
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    rule.enabled ? "bg-amber-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-background transition-transform ${
                      rule.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 flex-1">
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                {rule.description}
              </p>

              <div className="space-y-2 pt-2 border-t border-border font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[10px] uppercase">Threshold Parameter:</span>
                  <span className="font-bold text-foreground">
                    {rule.threshold} {rule.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={1000}
                  value={rule.threshold}
                  onChange={(e) => updateThreshold(rule.id, Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded bg-muted/40 border border-border text-[11px] font-mono flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] uppercase">Enforced Action:</span>
                <span className="text-amber-500 font-semibold">{rule.action}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
