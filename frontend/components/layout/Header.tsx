"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Menu,
  ChevronRight,
  Shield,
  Cpu,
} from "lucide-react";
import { ThemeSwitch } from "../ThemeSwitch";

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenCommand: () => void;
  wsConnected?: boolean;
}

export function Header({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenCommand,
  wsConnected = true,
}: HeaderProps) {
  const pathname = usePathname();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const getBreadcrumbs = () => {
    if (pathname === "/") return [{ name: "Dashboard", href: "/" }, { name: "Behavioral Threat Queue" }];
    if (pathname.startsWith("/simulate")) return [{ name: "Dashboard", href: "/" }, { name: "Live Event Sandbox" }];
    if (pathname.startsWith("/metrics")) return [{ name: "Dashboard", href: "/" }, { name: "Model Evaluation" }];
    if (pathname.startsWith("/drift")) return [{ name: "Dashboard", href: "/" }, { name: "Concept Drift Analysis" }];
    if (pathname.startsWith("/retraining")) return [{ name: "Dashboard", href: "/" }, { name: "Active Retraining Loop" }];
    if (pathname.startsWith("/rules")) return [{ name: "Dashboard", href: "/" }, { name: "Detection Guardrails & Rules" }];
    if (pathname.startsWith("/config")) return [{ name: "Dashboard", href: "/" }, { name: "SOC System Configuration" }];
    if (pathname.startsWith("/alerts")) return [{ name: "Dashboard", href: "/" }, { name: "Investigation Detail" }];
    return [{ name: "Dashboard", href: "/" }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-14 bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-30 px-4 flex items-center justify-between font-sans">
      {/* Left: Mobile Menu Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent md:hidden transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs font-mono">
          <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          {breadcrumbs.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/60" />}
              <span
                className={
                  idx === breadcrumbs.length - 1
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground transition-colors"
                }
              >
                {item.name}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Center: Search Trigger (Command Palette ⌘K) */}
      <div className="hidden md:flex items-center">
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border hover:border-ring text-muted-foreground text-xs font-mono w-64 justify-between transition-all group shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors truncate">
              Search telemetry, IPs...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-background text-[10px] text-muted-foreground border border-border font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Telemetry Badges, Theme Switch & Profile */}
      <div className="flex items-center gap-3">
        {/* Engine Pipeline Status */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground">
          <Cpu className="w-3.5 h-3.5 text-amber-500" />
          <span>L1: IForest</span>
          <span className="text-border">|</span>
          <span>L2: XGBoost</span>
        </div>

        {/* Live WebSocket Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected
                ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                : "bg-muted-foreground"
            }`}
          />
          <span
            className={
              wsConnected ? "text-amber-500 font-semibold" : "text-muted-foreground"
            }
          >
            {wsConnected ? "STREAM LIVE" : "OFFLINE"}
          </span>
        </div>

        {/* ThemeSwitch Component (Light / Dark / System) */}
        <ThemeSwitch />

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl p-4 z-50 space-y-3 font-mono text-xs animate-in fade-in duration-100">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-bold uppercase text-[11px]">
                  Real-time SOC Alerts
                </span>
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  WebSocket Stream
                </span>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="p-2 rounded bg-muted/50 border border-border">
                  <div className="text-amber-500 font-semibold flex justify-between">
                    <span>Critical Anomaly</span>
                    <span className="text-muted-foreground text-[9px]">Just now</span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2">
                    Impossible Travel detected for user_0020 (Oslo → Tokyo).
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/50 border border-border">
                  <div className="text-foreground font-semibold flex justify-between">
                    <span>Model Check</span>
                    <span className="text-muted-foreground text-[9px]">5m ago</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    ADWIN Concept Drift check completed: Baseline Stable.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
