import React from "react";
import { Alert } from "../lib/types";
import { Clock, MapPin, Globe, Terminal, ShieldAlert } from "lucide-react";

export function TimelineView({ alert }: { alert: Alert }) {
  // Generate contextual surrounding touchpoints based on attack type for demonstration
  const generateTouchpoints = () => {
    const baseTime = new Date(alert.timestamp);

    if (alert.attack_type === "impossible_travel") {
      const prevTime = new Date(baseTime.getTime() - 42 * 60000); // 42 minutes earlier
      return [
        {
          time: prevTime.toLocaleTimeString(),
          location: "Oslo, Norway (Usual Location)",
          ip: "84.215.12.9",
          action: "Successful login via SSO",
          status: "normal",
        },
        {
          time: baseTime.toLocaleTimeString(),
          location: `${alert.geo_city} (Improbable Distance)`,
          ip: alert.source_ip,
          action: `Login via ${alert.auth_method} on device '${alert.device_id}'`,
          status: "alert",
          note: "Implied travel speed > 12,000 km/h (exceeds physical maximum)",
        },
      ];
    }

    if (alert.attack_type === "lateral_movement") {
      return [
        {
          time: new Date(baseTime.getTime() - 10 * 60000).toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: "Read 'user-profile-db'",
          status: "normal",
        },
        {
          time: new Date(baseTime.getTime() - 6 * 60000).toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: "Read 'internal-wiki-docs'",
          status: "normal",
        },
        {
          time: baseTime.toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: `${alert.action.toUpperCase()} on '${alert.resource_accessed}'`,
          status: "alert",
          note: "Touched 6 distinct restricted resources in < 15 mins (1.2x normal breadth)",
        },
      ];
    }

    if (alert.attack_type === "brute_force") {
      return [
        {
          time: new Date(baseTime.getTime() - 2 * 60000).toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: "15 consecutive failed logins in 120s window",
          status: "alert",
          note: "High-frequency password guessing attempt from public IP",
        },
      ];
    }

    return [
      {
        time: baseTime.toLocaleTimeString(),
        location: alert.geo_city,
        ip: alert.source_ip,
        action: `${alert.action} on '${alert.resource_accessed}'`,
        status: "alert",
        note: alert.reason.split(".")[0],
      },
    ];
  };

  const touchpoints = generateTouchpoints();

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <span>Event Sequence & Behavioral Chronology</span>
      </h4>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {touchpoints.map((tp, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline Dot */}
            <span
              className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                tp.status === "alert"
                  ? "bg-amber-500 border-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse"
                  : "bg-slate-700 border-slate-900"
              }`}
            />

            <div
              className={`p-4 rounded-lg border transition-all ${
                tp.status === "alert"
                  ? "bg-amber-500/10 border-amber-500/30 shadow-md"
                  : "bg-slate-950/60 border-slate-800/80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono mb-1.5">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {tp.time}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {tp.location}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300/90 text-[11px]">
                  IP: {tp.ip}
                </span>
              </div>

              <div className="text-sm font-sans font-medium text-slate-200">
                {tp.action}
              </div>

              {tp.note && (
                <div className="mt-2 pt-2 border-t border-amber-500/20 text-xs font-mono text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>{tp.note}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
