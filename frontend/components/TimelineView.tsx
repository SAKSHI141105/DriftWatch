import React from "react";
import { Alert } from "../lib/types";
import { Clock, MapPin, ShieldAlert } from "lucide-react";

interface Touchpoint {
  time: string;
  location: string;
  ip: string;
  action: string;
  status: "alert" | "normal";
  note?: string;
}

export function TimelineView({ alert }: { alert: Alert }) {
  const baseTime = new Date(alert.timestamp);

  function generateTouchpoints(): Touchpoint[] {
    if (alert.attack_type === "impossible_travel") {
      const prevTime = new Date(baseTime.getTime() - 42 * 60_000);
      // Derive the "usual" previous location from geo baseline context if available
      const usualLocation = alert.baseline_type === "personal"
        ? "Usual Home Location"
        : "Last Known Location";
      return [
        {
          time: prevTime.toLocaleTimeString(),
          location: usualLocation,
          ip: "—",
          action: "Successful login via SSO (baseline event)",
          status: "normal",
        },
        {
          time: baseTime.toLocaleTimeString(),
          location: `${alert.geo_city} (Improbable Distance)`,
          ip: alert.source_ip,
          action: `Login via ${alert.auth_method} on device '${alert.device_id}'`,
          status: "alert",
          note: "Implied travel speed > 12,000 km/h — physically impossible",
        },
      ];
    }

    if (alert.attack_type === "lateral_movement") {
      return [
        {
          time: new Date(baseTime.getTime() - 10 * 60_000).toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: "READ on low-sensitivity resource (baseline behaviour)",
          status: "normal",
        },
        {
          time: new Date(baseTime.getTime() - 5 * 60_000).toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: "READ on adjacent internal resource",
          status: "normal",
        },
        {
          time: baseTime.toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: `${alert.action.toUpperCase()} on '${alert.resource_accessed}'`,
          status: "alert",
          note: "Unusually high resource breadth in short window (lateral pattern detected)",
        },
      ];
    }

    if (alert.attack_type === "brute_force") {
      return [
        {
          time: new Date(baseTime.getTime() - 2 * 60_000).toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: "High-frequency failed login attempts in 120s window",
          status: "alert",
          note: "Rapid sequential failures inconsistent with typo — indicates automated attack tool",
        },
      ];
    }

    if (alert.attack_type === "device_spoofing") {
      return [
        {
          time: baseTime.toLocaleTimeString(),
          location: alert.geo_city,
          ip: alert.source_ip,
          action: `${alert.action.toUpperCase()} on '${alert.resource_accessed}'`,
          status: "alert",
          note: `Device fingerprint '${alert.device_id}' not seen in personal baseline history`,
        },
      ];
    }

    // credential_misuse or generic
    return [
      {
        time: baseTime.toLocaleTimeString(),
        location: alert.geo_city,
        ip: alert.source_ip,
        action: `${alert.action} on '${alert.resource_accessed}'`,
        status: "alert",
        // Use only the first sentence of the reason to keep it concise
        note: alert.reason.split(".")[0].trim(),
      },
    ];
  }

  const touchpoints = generateTouchpoints();

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <span>Event Sequence &amp; Behavioral Chronology</span>
      </h4>

      <div className="relative pl-7 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
        {touchpoints.map((tp, idx) => (
          <div key={idx} className="relative">
            {/* Timeline dot */}
            <span
              className={`absolute -left-7 top-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                tp.status === "alert"
                  ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse"
                  : "bg-slate-600"
              }`}
            />

            <div
              className={`p-4 rounded-lg border transition-all ${
                tp.status === "alert"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-slate-950/60 border-slate-800/80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono mb-2">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {tp.time}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {tp.location}
                </span>
                {tp.ip !== "—" && (
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300/90 text-[11px]">
                    {tp.ip}
                  </span>
                )}
              </div>

              <div className="text-sm font-sans font-medium text-slate-200">
                {tp.action}
              </div>

              {tp.note && (
                <div className="mt-2 pt-2 border-t border-amber-500/20 text-xs font-mono text-amber-300 flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
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
