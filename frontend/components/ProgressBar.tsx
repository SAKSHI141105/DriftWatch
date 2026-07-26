import React from "react";

interface ProgressBarProps {
  value: number; // 0–1 float
  className?: string;
  /** Renders a faint background track if true (default: true) */
  showTrack?: boolean;
}

/**
 * Animated horizontal progress bar for metric visualisation.
 * Width animates in via a CSS transition; no JS animation library needed.
 */
export function ProgressBar({ value, className = "", showTrack = true }: ProgressBarProps) {
  const pct = Math.min(Math.max(value * 100, 0), 100);

  // Color shifts from muted amber to bright amber as value approaches 1
  const barColor =
    pct >= 90
      ? "bg-amber-400"
      : pct >= 70
      ? "bg-amber-500"
      : pct >= 50
      ? "bg-amber-600"
      : "bg-slate-600";

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`relative h-1.5 rounded-full overflow-hidden ${showTrack ? "bg-slate-800" : ""} ${className}`}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
