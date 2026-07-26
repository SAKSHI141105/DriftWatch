"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { Button } from "./ui/Button";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="scale-95 rounded-full">
        <Sun className="size-[1.2rem]" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="scale-95 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Toggle Theme"
      >
        <Sun className="size-[1.2rem] scale-100 rotate-0 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-36 rounded-xl bg-popover border border-border shadow-xl p-1 z-50 font-mono text-xs text-popover-foreground animate-in fade-in zoom-in-95 duration-100"
          onClick={() => setOpen(false)}
        >
          <button
            onClick={() => setTheme("light")}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </div>
            {theme === "light" && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setTheme("dark")}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </div>
            {theme === "dark" && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setTheme("system")}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5" />
              <span>System</span>
            </div>
            {theme === "system" && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
