"use client";

import React from "react";
import { SlidersHorizontal, Database, Server, Cpu, Shield, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export default function ConfigPage() {
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>SOC System &amp; Engine Configuration</span>
            <Badge variant="secondary">Production Stack</Badge>
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Core parameters for FastApi API backend, Isolation Forest model artifacts, and SQLite database persistence.
          </p>
        </div>
      </div>

      {/* Config Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-500" />
              <span>API Backend &amp; WebSocket Endpoints</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {[
              { label: "FastAPI REST Base URL", val: "http://localhost:8000/api" },
              { label: "WebSocket Real-Time Stream", val: "ws://localhost:8000/ws/alerts" },
              { label: "CORS Allowed Origins", val: "http://localhost:3000, http://localhost:3001" },
              { label: "Inference Threshold (Min Risk)", val: "40 / 100" },
              { label: "WebSocket Heartbeat Backoff", val: "1s -> 30s Exponential" },
            ].map(({ label, val }) => (
              <div key={label} className="p-3 rounded bg-muted/40 border border-border flex justify-between items-center">
                <span className="text-muted-foreground text-[10px] uppercase">{label}</span>
                <span className="font-bold text-foreground truncate max-w-[200px]" title={val}>{val}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <span>SQLite Persistence &amp; Storage</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {[
              { label: "Database Engine", val: "SQLite 3 (WAL Mode)" },
              { label: "DB File Path", val: "backend/data/driftwatch.db" },
              { label: "Alerts Table Indexing", val: "Indexed by timestamp & status" },
              { label: "Feedback Audit Table", val: "foreign_key (alert_id) REFERENCES alerts(id)" },
              { label: "Parquet Dataset Baseline", val: "backend/data/access_logs.parquet" },
            ].map(({ label, val }) => (
              <div key={label} className="p-3 rounded bg-muted/40 border border-border flex justify-between items-center">
                <span className="text-muted-foreground text-[10px] uppercase">{label}</span>
                <span className="font-bold text-foreground truncate max-w-[200px]" title={val}>{val}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
