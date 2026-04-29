"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SavedPill — tiny status chip showing the last save state.
 *
 * Three visual states:
 *   - "saving"  → pulsing red dot + "Saving…"     (while a server action runs)
 *   - "saved"   → green check + "Saved"           (briefly after success)
 *   - "idle"    → nothing rendered
 *
 * The "saved" state self-clears after `dwellMs` (default 2.4s) so the
 * pill doesn't linger forever next to the page header. Pass `state="saving"`
 * while the action is in-flight; flip to `"saved"` on success and the
 * pill handles the rest.
 *
 * Trust signal: every coach mutation in Rostr should show one of these
 * so "did that save?" is never a question.
 */
export function SavedPill({
  state,
  dwellMs = 2400,
  className,
}: {
  state: "idle" | "saving" | "saved";
  dwellMs?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState<"idle" | "saving" | "saved">(state);

  useEffect(() => {
    if (state === "saved") {
      setVisible("saved");
      const t = setTimeout(() => setVisible("idle"), dwellMs);
      return () => clearTimeout(t);
    }
    setVisible(state);
  }, [state, dwellMs]);

  if (visible === "idle") return null;

  if (visible === "saving") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-paper border border-hair text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3",
          className,
        )}
      >
        <Loader2 className="w-2.5 h-2.5 animate-spin text-red" />
        Saving…
      </span>
    );
  }

  // saved
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em] animate-in fade-in-0 duration-200",
        className,
      )}
    >
      <Check className="w-2.5 h-2.5" />
      Saved
    </span>
  );
}
