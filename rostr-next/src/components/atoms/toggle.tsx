"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Toggle — atoms/toggle
 * COMPONENTS.md §Atoms/<Toggle>: 34×20 track, ink on / paper-deep off, 16px white knob.
 */
export interface ToggleProps {
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function Toggle({ on, onChange, disabled, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={cn(
        "relative inline-flex items-center w-[34px] h-[20px] rounded-full transition-colors duration-150",
        on ? "bg-ink" : "bg-paper-deep",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 w-[16px] h-[16px] m-0.5 rounded-full bg-white shadow-sm transition-transform duration-150",
          on ? "translate-x-[14px]" : "translate-x-0",
        )}
      />
    </button>
  );
}
