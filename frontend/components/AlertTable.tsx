"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ExternalLink,
  Filter,
} from "lucide-react";
import { AlertSummary } from "../lib/types";
import { RiskBadge } from "./RiskBadge";
import { submitFeedback } from "../lib/api";

interface AlertTableProps {
  alerts: AlertSummary[];
  onStatusChange?: (alertId: string, newStatus: string) => void;
}

const ATTACK_TYPES = [
  "ALL",
  "brute_force",
  "credential_misuse",
  "lateral_movement",
  "impossible_travel",
  "device_spoofing",
] as const;

const STATUSES = ["open", "confirmed", "dismissed", "ALL"] as const;

export function AlertTable({ alerts, onStatusChange }: AlertTableProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleFeedback = async (
    e: React.MouseEvent,
    alertId: string,
    action: "confirm" | "dismiss"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setProcessingId(alertId);
      await submitFeedback(alertId, {
        action,
        note: `Quick analyst ${action} from dashboard`,
      });
      onStatusChange?.(alertId, action === "confirm" ? "confirmed" : "dismissed");
    } catch (err) {
      console.error("Feedback failed:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterType !== "ALL" && a.attack_type !== filterType) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-start gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 backdrop-blur-sm">
        {/* Attack class filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">Class:</span>
          <div className="flex flex-wrap gap-1">
            {ATTACK_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-all ${
                  filterType === type
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                    : "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
                }`}
              >
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter + result count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono uppercase text-slate-400">Status:</span>
          {STATUSES.map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-all ${
                filterStatus === st
                  ? "bg-slate-700 text-slate-100 border border-slate-600 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
            {filteredAlerts.length} results
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0f172a]/80 backdrop-blur-md overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/90 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 whitespace-nowrap">User &amp; Time</th>
                <th className="py-3 px-4 whitespace-nowrap">Risk</th>
                <th className="py-3 px-4 whitespace-nowrap">Resource</th>
                <th className="py-3 px-4">Explanation (excerpt)</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Baseline</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              <AnimatePresence initial={false}>
                {filteredAlerts.length === 0 ? (
                  <tr key="empty">
                    <td
                      colSpan={6}
                      className="py-12 text-center text-slate-500 font-mono"
                    >
                      No alerts match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <motion.tr
                      key={alert.id}
                      layout
                      initial={{
                        opacity: 0,
                        y: -8,
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: "rgba(0, 0, 0, 0)",
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.25 }}
                      className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      {/* User & Time */}
                      <td className="py-3.5 px-4 font-mono">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <div className="flex items-center gap-1.5 text-slate-200 font-semibold group-hover:text-amber-300 transition-colors">
                            {alert.user_id}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400 shrink-0" />
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                            <span className="text-slate-700 mx-0.5">·</span>
                            <MapPin className="w-3 h-3" />
                            <span>{alert.geo_city}</span>
                          </div>
                        </Link>
                      </td>

                      {/* Risk badge */}
                      <td className="py-3.5 px-4">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <RiskBadge
                            score={alert.risk_score}
                            attackType={alert.attack_type}
                            size="sm"
                          />
                        </Link>
                      </td>

                      {/* Resource & Action */}
                      <td className="py-3.5 px-4 font-mono max-w-[160px]">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <div className="text-slate-300 font-medium truncate">
                            {alert.resource_accessed}
                          </div>
                          <div className="text-[10px] uppercase text-amber-400/80 tracking-wide mt-0.5">
                            {alert.action}
                          </div>
                        </Link>
                      </td>

                      {/* Reason excerpt */}
                      <td className="py-3.5 px-4 max-w-md">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <p className="text-slate-400 line-clamp-2 leading-relaxed text-[11px]">
                            {alert.reason}
                          </p>
                        </Link>
                      </td>

                      {/* Baseline */}
                      <td className="py-3.5 px-4 text-center font-mono text-[10px]">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border uppercase ${
                              alert.baseline_type === "personal"
                                ? "bg-slate-800/80 text-slate-400 border-slate-700"
                                : "bg-amber-950/40 text-amber-300 border-amber-800/60"
                            }`}
                          >
                            {alert.baseline_type}
                          </span>
                        </Link>
                      </td>

                      {/* Analyst action */}
                      <td className="py-3.5 px-4 text-right">
                        {alert.status === "open" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleFeedback(e, alert.id, "confirm")}
                              disabled={processingId === alert.id}
                              title="Confirm Attack (Feeds Retraining)"
                              className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleFeedback(e, alert.id, "dismiss")}
                              disabled={processingId === alert.id}
                              title="Dismiss False Positive"
                              className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider border ${
                              alert.status === "confirmed"
                                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                                : "bg-slate-800 text-slate-500 border-slate-700"
                            }`}
                          >
                            {alert.status}
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
