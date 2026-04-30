"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldQuestion, Loader2 } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import { verifyHighlightAction } from "./actions";

/**
 * VerifyHighlightButton — coach-side action used on
 * /app/roster/[id]/reported.
 *
 * UX requirements (Phase 5 spec):
 *   - Confirmation dialog before submit. Coach must explicitly accept
 *     "I confirm this highlight is accurate" — clicking the row button
 *     alone does NOT verify.
 *   - Clear loading state while the server action runs.
 *   - Clear success feedback (toast + button flips to "Verified" badge).
 *   - Disabled when already verified — re-verifying is allowed via
 *     server action but we hide the button to keep the page calm.
 *
 * The button is visually consistent with the data-source-badge atoms
 * so the verify control sits naturally next to the existing badges.
 */
export function VerifyHighlightButton({
  highlightId,
  caption,
  url,
  alreadyVerified,
}: {
  highlightId: string;
  caption: string | null;
  url: string;
  /** When true, render the static "Verified" pill instead of a button. */
  alreadyVerified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (alreadyVerified) {
    // Static, non-interactive — re-verify is intentionally not a UI
    // surface yet. Coach-side unverify is a future iteration.
    return (
      <span
        title="Already coach-verified"
        className="inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em] bg-grass-dim text-grass border border-grass/20 px-2 py-0.5 text-[10.5px]"
      >
        <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
        Verified
      </span>
    );
  }

  function submit() {
    startTransition(async () => {
      const res = await verifyHighlightAction(highlightId);
      if (res.error) {
        toast.error("Couldn't verify", { description: res.error });
        return;
      }
      toast.success("Highlight verified", {
        description: caption ?? "The clip now shows the Verified badge publicly.",
      });
      setOpen(false);
      // Re-fetch this server component's data so the row flips to the
      // Verified pill without a page reload.
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em]",
          "bg-grass text-white border border-grass shadow-[0_2px_6px_-2px_rgba(47,125,79,0.4)]",
          "px-2.5 py-1 text-[10.5px]",
          "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          "hover:brightness-110 active:scale-[0.96] disabled:opacity-60 disabled:active:scale-100",
        )}
      >
        <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
        Verify
      </button>

      <Modal
        open={open}
        onOpenChange={(v) => (pending ? null : setOpen(v))}
        size="sm"
        title="Verify this highlight?"
        description="You are confirming this highlight is accurate."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-hair bg-paper-deep px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
              Clip
            </div>
            <div className="font-display text-[14px] font-semibold tracking-tight">
              {caption || "Untitled highlight"}
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-[11.5px] text-red truncate hover:underline"
            >
              {url}
            </a>
          </div>
          <p className="text-[12.5px] text-ink-2 leading-relaxed">
            Once verified, the clip will display a{" "}
            <span className="inline-flex items-center gap-1 align-baseline rounded-full bg-grass-dim text-grass border border-grass/20 px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-[0.06em]">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>{" "}
            badge on the player&apos;s public profile, and the player will
            no longer be able to delete or modify it from their editor.
          </p>
          <p className="text-[11.5px] text-ink-3 leading-snug flex items-start gap-2">
            <ShieldQuestion className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Only verify clips you&apos;ve actually watched. A coach
              vouching for a clip is the trust signal recruiters rely on.
            </span>
          </p>
        </div>
        <ModalFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-md border border-hair bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-paper-deep transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md bg-grass text-white px-3.5 py-1.5 text-[13px] font-bold",
              "shadow-[0_2px_8px_-2px_rgba(47,125,79,0.4)]",
              "transition active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100",
            )}
          >
            {pending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                Confirm verify
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}
