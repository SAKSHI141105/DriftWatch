"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Activity, BarChart3, Radio, Cpu, Terminal } from "lucide-react";

export function Navbar({ wsConnected = true }: { wsConnected?: boolean }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Alert Queue", href: "/", icon: Shield },
    { name: "Model Metrics & Drift", href: "/metrics", icon: BarChart3 },
    { name: "Live Simulator", href: "/simulate", icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-slate-100 flex items-center gap-1.5">
              DriftWatch <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">SOC v1.0</span>
            </span>
            <p className="text-[11px] text-slate-400 font-mono -mt-0.5">Behavioral Anomaly Engine</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-800 text-amber-400 shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>Layer 1: <strong className="text-slate-200 font-normal">IForest</strong></span>
          <span className="text-slate-600">|</span>
          <span>Layer 2: <strong className="text-slate-200 font-normal">XGBoost</strong></span>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-slate-600"}`} />
          <span className={wsConnected ? "text-amber-300 font-medium" : "text-slate-500"}>
            {wsConnected ? "STREAM ACTIVE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
