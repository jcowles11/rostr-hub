/**
 * Shared layout primitives.
 *
 * These three components carry the "Direction D" aesthetic that TeamHome
 * established. Using them across every coach-facing page keeps the product
 * visually coherent without each page hand-rolling headers and section labels.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── PageHeader ─────────────────────────────────────────────────────

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}

/**
 * Compact typography-driven page header. Replaces the gradient `.page-hero`
 * pattern. Title uses 20px extrabold; subtitle a muted 11px line.
 */
export function PageHeader({ title, subtitle, right, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[20px] font-extrabold tracking-tight leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0 ml-3">{right}</div>}
    </div>
  );
}

// ── SectionHeading ─────────────────────────────────────────────────

export interface SectionHeadingProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * The uppercase tracking-widest muted label that titles every section on
 * the home page. Optional `action` slot for a right-aligned text link.
 */
export function SectionHeading({ children, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-baseline justify-between mb-2.5", className)}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {children}
      </p>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── StatusPill ─────────────────────────────────────────────────────

export type StatusPillTone = "neutral" | "attention" | "success" | "danger" | "info";

export interface StatusPillProps {
  tone?: StatusPillTone;
  children: ReactNode;
  className?: string;
}

/**
 * Dot + label pill used in page headers to signal global state
 * ("3 to do", "On track", "Needs attention", etc).
 */
export function StatusPill({ tone = "neutral", children, className }: StatusPillProps) {
  const styles: Record<StatusPillTone, { bg: string; text: string; dot: string }> = {
    neutral:   { bg: "bg-muted/60",        text: "text-muted-foreground", dot: "bg-muted-foreground" },
    attention: { bg: "bg-secondary/10",    text: "text-secondary",        dot: "bg-secondary" },
    success:   { bg: "bg-accent/10",       text: "text-accent",           dot: "bg-accent" },
    danger:    { bg: "bg-destructive/10",  text: "text-destructive",      dot: "bg-destructive" },
    info:      { bg: "bg-primary/10",      text: "text-primary",          dot: "bg-primary" },
  };
  const s = styles[tone];
  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full", s.bg, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      <span className={cn("text-[10px] font-bold uppercase tracking-wider", s.text)}>
        {children}
      </span>
    </div>
  );
}
