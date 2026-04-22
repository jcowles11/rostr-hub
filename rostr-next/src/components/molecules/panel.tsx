import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Panel — molecules/panel
 * The standard card + head + body shell used across the Coach Hub
 * (see handoff/designs/02_Coach_Hub.html .panel).
 */
export function Panel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-card border border-hair rounded-lg overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PanelHeadProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PanelHead({ title, actions, className }: PanelHeadProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-[18px] py-4 border-b border-hair-2",
        className,
      )}
    >
      <h3 className="font-display text-[15px] font-semibold tracking-tight">
        {title}
      </h3>
      {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function PanelBody({
  children,
  className,
  padded = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={cn(padded ? "p-[18px]" : "", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Panel tab — small button inside the panel head actions slot.
 * Active variant matches the Coach Hub .panel-head .tab.active style.
 */
export function PanelTab({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[12px] font-medium rounded-[6px] px-2.5 py-1 transition-colors",
        active
          ? "bg-paper text-ink font-semibold"
          : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
