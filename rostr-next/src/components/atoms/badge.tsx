import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — atoms/badge
 * COMPONENTS.md §Atoms/<Badge>: 10 variants; uppercase 10.5px/700 label.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[5px] px-[7px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em] whitespace-nowrap",
  {
    variants: {
      variant: {
        live: "bg-red-soft text-red before:inline-block before:w-[6px] before:h-[6px] before:rounded-full before:bg-red before:animate-pulse-live before:mr-1",
        keep: "bg-grass-dim text-grass",
        bubble: "bg-amber-soft text-amber",
        cut: "bg-red-soft text-red",
        undecided: "bg-paper-deep text-ink-3",
        linked: "bg-grass-dim text-grass",
        pending: "bg-amber-soft text-amber",
        unlinked: "bg-paper-deep text-ink-3",
        verified: "bg-grass-dim text-grass",
        ai: "bg-ink text-white",
      },
    },
    defaultVariants: {
      variant: "undecided",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === "verified" && <span aria-hidden>✓</span>}
      {variant === "ai" && (
        <span aria-hidden className="w-[5px] h-[5px] rounded-full bg-red" />
      )}
      {children}
    </span>
  );
}
