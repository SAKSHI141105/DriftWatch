"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  BarChart3,
  Terminal,
  Radio,
  ChevronLeft,
  ChevronRight,
  Activity,
  SlidersHorizontal,
  UserCheck,
  Zap,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const navGroups = [
    {
      title: "Overview",
      items: [
        { name: "Threat Queue", href: "/", icon: Shield, badge: "Live" },
        { name: "Live Sandbox", href: "/simulate", icon: Terminal, badge: "Hot Path" },
        { name: "Model Evaluation", href: "/metrics", icon: BarChart3 },
      ],
    },
    {
      title: "SOC Operations",
      items: [
        { name: "Retraining Loop", href: "/retraining", icon: UserCheck },
        { name: "Concept Drift", href: "/drift", icon: Activity },
        { name: "Guardrails & Rules", href: "/rules", icon: Zap },
      ],
    },
    {
      title: "System",
      items: [
        { name: "Configuration", href: "/config", icon: SlidersHorizontal },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex flex-col ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-sidebar-border shrink-0">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="font-bold text-sm tracking-tight text-sidebar-foreground flex items-center gap-1.5">
                DriftWatch
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40">
                  SOC
                </span>
              </span>
              <p className="text-[10px] text-muted-foreground font-mono -mt-0.5 truncate">
                Behavioral AI Engine
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Workspace / Engine Banner */}
      {!collapsed && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border font-mono text-[11px] space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Detection Engine</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-amber-500 font-semibold text-[10px]">
            L1 (IForest) + L2 (XGBoost)
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <h4 className="px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                {group.title}
              </h4>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group ${
                    isActive
                      ? "bg-sidebar-accent text-amber-500 font-semibold border border-sidebar-border shadow-sm"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-amber-500"
                        : "text-muted-foreground group-hover:text-sidebar-foreground"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.name}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground uppercase">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border text-muted-foreground flex items-center justify-center hover:bg-sidebar-accent hover:text-sidebar-foreground shadow-md transition-transform"
        title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div
          className={`flex items-center gap-2.5 p-2 rounded-lg bg-sidebar-accent/40 border border-sidebar-border ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-mono font-bold text-amber-500 text-xs shrink-0">
            SA
          </div>
          {!collapsed && (
            <div className="truncate flex-1 font-mono">
              <div className="text-xs font-semibold text-sidebar-foreground truncate">
                SOC Analyst Tier-2
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                analyst@driftwatch.sec
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
