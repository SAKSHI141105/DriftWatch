import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "amber";
}

export function Badge({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring uppercase tracking-wider";

  const variants = {
    default: "border-border bg-secondary text-secondary-foreground",
    secondary: "border-border bg-muted text-muted-foreground",
    amber: "border-amber-500/40 bg-amber-500/15 text-amber-500",
    warning: "border-amber-500/40 bg-amber-500/15 text-amber-500",
    destructive: "border-rose-500/40 bg-rose-500/15 text-rose-500",
    success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-500",
    outline: "border-border text-muted-foreground",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
