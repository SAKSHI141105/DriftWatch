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
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";
import { AlertSummary } from "../lib/types";
import { RiskBadge } from "./RiskBadge";
import { submitFeedback } from "../lib/api";
import { Button } from "./ui/Button";

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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchUser = a.user_id.toLowerCase().includes(q);
      const matchResource = a.resource_accessed.toLowerCase().includes(q);
      const matchCity = a.geo_city.toLowerCase().includes(q);
      const matchReason = a.reason.toLowerCase().includes(q);
      if (!matchUser && !matchResource && !matchCity && !matchReason)
        return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const paginatedAlerts = filteredAlerts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-3 font-sans">
      {/* Table Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border text-card-foreground">
        {/* Left: Search input */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by user, resource, city, or reason..."
              className="w-full bg-background border border-input rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:border-ring transition-colors"
            />
          </div>
        </div>

        {/* Right: Attack type filter & Status filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Select Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase text-muted-foreground">Class:</span>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-background border border-input rounded-lg px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:border-ring uppercase"
            >
              {ATTACK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Status Select Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase text-muted-foreground">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-background border border-input rounded-lg px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:border-ring uppercase"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm text-card-foreground">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    <span>User &amp; Location</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">Risk Classification</th>
                <th className="py-3 px-4 whitespace-nowrap">Resource Touched</th>
                <th className="py-3 px-4">Behavioral Explanation (SHAP)</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Baseline</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs font-sans">
              <AnimatePresence initial={false}>
                {paginatedAlerts.length === 0 ? (
                  <tr key="empty">
                    <td
                      colSpan={6}
                      className="py-12 text-center text-muted-foreground font-mono"
                    >
                      <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
                      No behavioral alerts match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedAlerts.map((alert) => (
                    <motion.tr
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="group hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      {/* User & Time */}
                      <td className="py-3.5 px-4 font-mono">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <div className="flex items-center gap-1.5 text-foreground font-bold group-hover:text-amber-500 transition-colors">
                            {alert.user_id}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 shrink-0" />
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-border mx-0.5">·</span>
                            <MapPin className="w-3 h-3" />
                            <span>{alert.geo_city}</span>
                          </div>
                        </Link>
                      </td>

                      {/* Risk Classification */}
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
                      <td className="py-3.5 px-4 font-mono max-w-[170px]">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <div className="text-foreground font-semibold truncate">
                            {alert.resource_accessed}
                          </div>
                          <div className="text-[10px] uppercase text-amber-500 font-medium tracking-wide mt-0.5">
                            {alert.action}
                          </div>
                        </Link>
                      </td>

                      {/* Reason excerpt */}
                      <td className="py-3.5 px-4 max-w-md">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <p className="text-muted-foreground line-clamp-2 leading-relaxed text-[11px]">
                            {alert.reason}
                          </p>
                        </Link>
                      </td>

                      {/* Baseline */}
                      <td className="py-3.5 px-4 text-center font-mono text-[10px]">
                        <Link href={`/alerts/${alert.id}`} className="block">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border uppercase font-medium ${
                              alert.baseline_type === "personal"
                                ? "bg-muted text-muted-foreground border-border"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                            }`}
                          >
                            {alert.baseline_type}
                          </span>
                        </Link>
                      </td>

                      {/* Analyst Verification */}
                      <td className="py-3.5 px-4 text-right">
                        {alert.status === "open" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) =>
                                handleFeedback(e, alert.id, "confirm")
                              }
                              disabled={processingId === alert.id}
                              title="Confirm Threat (Retrains Model)"
                              className="p-1.5 rounded bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) =>
                                handleFeedback(e, alert.id, "dismiss")
                              }
                              disabled={processingId === alert.id}
                              title="Dismiss False Positive"
                              className="p-1.5 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 border border-rose-500/30 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider border ${
                              alert.status === "confirmed"
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border"
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

        {/* Shadcn-style Data Table Pagination Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/40 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <div>
            Showing{" "}
            <strong className="text-foreground">
              {filteredAlerts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{" "}
            to{" "}
            <strong className="text-foreground">
              {Math.min(currentPage * pageSize, filteredAlerts.length)}
            </strong>{" "}
            of <strong className="text-foreground">{filteredAlerts.length}</strong>{" "}
            alerts
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
            </Button>
            <span className="px-2 text-foreground text-[11px]">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
