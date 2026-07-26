import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "amber";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "default",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none";

    const variants = {
      default:
        "bg-primary text-primary-foreground shadow hover:opacity-90 border border-transparent",
      amber:
        "bg-amber-500 text-slate-950 shadow hover:bg-amber-400 font-semibold shadow-[0_0_15px_rgba(245,158,11,0.25)]",
      destructive:
        "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30",
      outline:
        "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      ghost: "hover:bg-accent text-muted-foreground hover:text-foreground",
      link: "text-amber-500 underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-8 px-3.5 py-1.5",
      sm: "h-7 rounded-md px-2.5 text-[11px]",
      lg: "h-9 rounded-lg px-4 text-xs font-semibold",
      icon: "h-8 w-8",
    };

    return (
      <button
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
