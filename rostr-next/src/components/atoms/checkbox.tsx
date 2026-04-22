"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checkbox — atoms/checkbox
 * COMPONENTS.md §Atoms/<Checkbox>: 14×14, ink+white check when checked, hair border when off.
 */
export interface CheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function Checkbox({ checked, onChange, disabled, className, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex items-center justify-center w-[14px] h-[14px] rounded-[3px] transition-colors",
        checked ? "bg-ink border border-ink" : "bg-card border border-hair",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {checked && <Check className="w-[10px] h-[10px] text-white" strokeWidth={3} />}
    </button>
  );
}
