"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Shield,
  Terminal,
  BarChart3,
  Radio,
  Zap,
  X,
  ArrowRight,
} from "lucide-react";

interface CommandMenuProps {
  open: boolean;
  onClose: () => void;
}

export function CommandMenu({ open, onClose }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else {
          // Toggle
        }
      } else if (e.key === "Escape" && open) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const actions = [
    {
      category: "Navigation",
      items: [
        { name: "Threat Queue Dashboard", href: "/", icon: Shield, desc: "Active behavioral threat queue" },
        { name: "Live Event Sandbox", href: "/simulate", icon: Terminal, desc: "Inject synthetic attack telemetry" },
        { name: "Model Evaluation & Drift", href: "/metrics", icon: BarChart3, desc: "Layer 1 & Layer 2 performance benchmarks" },
      ],
    },
    {
      category: "Attack Presets & Simulation",
      items: [
        { name: "Impossible Travel (Oslo → Tokyo)", href: "/simulate", icon: Zap, desc: "Preset: Speed > 800 km/h anomaly" },
        { name: "Brute Force Password Attack", href: "/simulate", icon: Zap, desc: "Preset: 15 failed logins in 2m window" },
        { name: "Credential Misuse (Novel Device)", href: "/simulate", icon: Zap, desc: "Preset: Off-hours access from unknown IP" },
      ],
    },
  ];

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4 font-sans">
      <div
        className="w-full max-w-xl rounded-xl bg-card border border-border shadow-2xl overflow-hidden font-mono text-xs animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/60">
          <Search className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search pages, or select an attack preset..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-xs"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 max-h-96 overflow-y-auto space-y-4">
          {actions.map((group, idx) => {
            const filteredItems = group.items.filter(
              (item) =>
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                item.desc.toLowerCase().includes(query.toLowerCase())
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 tracking-wider">
                  {group.category}
                </div>
                {filteredItems.map((item, itemIdx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={itemIdx}
                      onClick={() => handleSelect(item.href)}
                      className="w-full text-left p-2.5 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border hover:border-border flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-foreground font-semibold group-hover:text-amber-500 transition-colors">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/80 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>DriftWatch SOC Command Palette</span>
          <div className="flex items-center gap-2">
            <span>Use ↑↓ to navigate</span>
            <span>·</span>
            <span>ESC to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
