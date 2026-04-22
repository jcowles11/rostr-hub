import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Kbd — atoms/kbd
 * COMPONENTS.md §Atoms/<Kbd>: mono 10.5px, card bg, hair border.
 */
export function Kbd({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center font-mono text-[10.5px] leading-none text-ink-4",
        "px-1.5 py-0.5 bg-card border border-hair rounded-[4px]",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
