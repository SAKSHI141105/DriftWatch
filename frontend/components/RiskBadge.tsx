import React from "react";

interface RiskBadgeProps {
  score: number;
  attackType?: string;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ score, attackType, size = "md" }: RiskBadgeProps) {
  // PRD §7: Single accent color family (amber) expressed through intensity (pale -> saturated)
  let intensityClass = "";
  let badgeLabel = "LOW RISK";

  if (score >= 90) {
    intensityClass =
      "bg-amber-500/20 text-[#78350f] dark:text-amber-200 border-amber-500/60 font-bold shadow-[0_0_16px_rgba(245,158,11,0.25)] animate-pulse";
    badgeLabel = "CRITICAL";
  } else if (score >= 70) {
    intensityClass =
      "bg-amber-500/15 text-[#78350f] dark:text-amber-300 border-amber-500/50 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.15)]";
    badgeLabel = "HIGH";
  } else if (score >= 40) {
    intensityClass =
      "bg-amber-500/10 text-[#78350f] dark:text-amber-300/90 border-amber-500/40 font-medium";
    badgeLabel = "ELEVATED";
  } else {
    intensityClass =
      "bg-muted/80 text-muted-foreground border-border font-normal";
    badgeLabel = "MINIMAL";
  }

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }[size];

  const formattedType = attackType
    ? attackType.replace(/_/g, " ").toUpperCase()
    : badgeLabel;

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center rounded font-mono border tracking-wide transition-all ${sizeClasses} ${intensityClass}`}
      >
        <span className="opacity-75 mr-1 font-normal">RISK</span>
        <span>{score}</span>
      </span>

      {attackType && (
        <span
          className={`inline-flex items-center rounded font-mono tracking-wider uppercase border border-border bg-card text-muted-foreground ${
            size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[11px]"
          }`}
        >
          {formattedType}
        </span>
      )}
    </div>
  );
}
