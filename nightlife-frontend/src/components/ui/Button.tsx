// src/components/ui/Button.tsx
"use client";

import * as React from "react";
import clsx from "clsx";

type Variant = "accent" | "secondary" | "ghost";

export function Button({
  children,
  className,
  variant = "accent",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] focus-visible:outline-none";
  const styles: Record<Variant, string> = {
    accent:
      "bg-nl-accent text-white hover:bg-nl-accent/90 shadow-soft",
    secondary:
      "bg-nl-secondary text-white hover:bg-nl-secondary/90 shadow-soft",
    ghost:
      "bg-transparent text-white/80 hover:text-white border border-white/10",
  };

  return (
    <button
      className={clsx(base, styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
