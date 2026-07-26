"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, BarChart3, Radio, Cpu, Terminal } from "lucide-react";

export function Navbar({ wsConnected = true }: { wsConnected?: boolean }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Alert Queue", href: "/", icon: Shield },
    { name: "Model Metrics & Drift", href: "/metrics", icon: BarChart3 },
    { name: "Live Simulator", href: "/simulate", icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
              DriftWatch
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-amber-500 border border-border">
                SOC v1.0
              </span>
            </span>
            <p className="text-[10px] text-muted-foreground font-mono -mt-0.5">
              Behavioral Anomaly Engine
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-muted text-amber-500 shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-amber-500" : "text-muted-foreground"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3 text-xs font-mono shrink-0">
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-muted border border-border text-muted-foreground">
          <Cpu className="w-3.5 h-3.5" />
          <span>
            L1: <strong className="text-foreground font-normal">IForest</strong>
          </span>
          <span className="text-border">|</span>
          <span>
            L2: <strong className="text-foreground font-normal">XGBoost</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-muted border border-border">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              wsConnected
                ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                : "bg-muted-foreground"
            }`}
          />
          <span
            className={
              wsConnected ? "text-amber-500 font-medium" : "text-muted-foreground"
            }
          >
            {wsConnected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
