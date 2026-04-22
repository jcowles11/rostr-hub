"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chip — atoms/chip
 * COMPONENTS.md §Atoms/<Chip>: 6×11 padding, radius 7, card bg, hair border.
 * `on` = ink bg + white text. Optional × remove.
 */
export interface ChipProps {
  on?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Chip({
  on = false,
  removable = false,
  onRemove,
  onClick,
  children,
  className,
}: ChipProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-[11px] py-1.5 rounded-sm text-[12.5px] font-medium transition-colors",
        on
          ? "bg-ink text-white border border-ink"
          : "bg-card border border-hair text-ink-2 hover:text-ink",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <span>{children}</span>
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-full w-[14px] h-[14px]",
            on ? "hover:bg-white/20" : "hover:bg-paper-deep",
          )}
          aria-label="Remove"
        >
          <X className="w-[10px] h-[10px]" />
        </button>
      )}
    </span>
  );
}
