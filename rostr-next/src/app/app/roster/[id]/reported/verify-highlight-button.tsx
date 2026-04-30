"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldQuestion, ShieldOff, Loader2 } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import { verifyHighlightAction, unverifyHighlightAction } from "./actions";

/**
 * VerifyHighlightControls — coach-side verify / unverify control used
 * on /app/roster/[id]/reported.
 *
 * Two modes share one component because the visual context is the
 * same (a per-row pill at the right edge of each clip):
 *
 *   - alreadyVerified=false → green Verify pill → opens the
 *     "I confirm this highlight is accurate" modal. On confirm,
 *     calls verifyHighlightAction.
 *
 *   - alreadyVerified=true  → green Verified pill → opens the
 *     "Remove verification?" modal. On confirm, calls
 *     unverifyHighlightAction.
 *
 * Both flows share Phase-5 spec: a coach must explicitly accept the
 * confirmation before the action runs. Pending state shows a spinner;
 * success shows a toast and refreshes the route so the row's
 * verified state flips in place without a full reload.
 *
 * Component name kept (verify-highlight-button.tsx) to avoid churn —
 * it now handles both transitions.
 */
export function VerifyHighlightButton({
  highlightId,
  caption,
  url,
  alreadyVerified,
  verifiedByName,
  verifiedAt,
}: {
  highlightId: string;
  caption: string | null;
  url: string;
  alreadyVerified: boolean;
  /** Display name of the coach who verified — used in unverify modal. */
  verifiedByName?: string | null;
  /** ISO timestamp of the most recent verification. */
  verifiedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const action = alreadyVerified
        ? unverifyHighlightAction
        : verifyHighlightAction;
      const res = await action(highlightId);
      if (res.error) {
        toast.error(
          alreadyVerified ? "Couldn't unverify" : "Couldn't verify",
          { description: res.error },
        );
        return;
      }
      toast.success(
        alreadyVerified ? "Verification removed" : "Highlight verified",
        {
          description:
            caption ??
            (alreadyVerified
              ? "The clip is back in player-reported state."
              : "The clip now shows the Verified badge publicly."),
        },
      );
      setOpen(false);
      router.refresh();
    });
  }

  // ── Verified state: pill is interactive, opens unverify modal ──
  if (alreadyVerified) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          title="Remove verification"
          className={cn(
            "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em]",
            "bg-grass-dim text-grass border border-grass/20",
            "px-2 py-0.5 text-[10.5px]",
            "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "hover:bg-grass/15 active:scale-[0.96] disabled:opacity-60 disabled:active:scale-100",
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
          Verified
        </button>

        <Modal
          open={open}
          onOpenChange={(v) => (pending ? null : setOpen(v))}
          size="sm"
          title="Remove verification?"
          description="The clip will revert to player-reported state."
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
              {(verifiedByName || verifiedAt) && (
                <div className="mt-2 text-[11px] text-ink-3 leading-snug">
                  {verifiedByName && <>Verified by <span className="font-semibold text-ink-2">{verifiedByName}</span></>}
                  {verifiedByName && verifiedAt && " · "}
                  {verifiedAt && new Date(verifiedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <p className="text-[12.5px] text-ink-2 leading-relaxed">
              The Verified badge will disappear from the player&apos;s public
              profile, and the player will be able to delete the clip again.
              You (or another coach in the program) can re-verify later.
            </p>
            <p className="text-[11.5px] text-ink-3 leading-snug flex items-start gap-2">
              <ShieldQuestion className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Use this if you verified the wrong clip or the player edited
                it in a misleading way.
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
                "inline-flex items-center justify-center gap-1.5 rounded-md bg-red text-white px-3.5 py-1.5 text-[13px] font-bold",
                "shadow-[0_2px_8px_-2px_rgba(200,58,58,0.4)]",
                "transition active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100",
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Removing…
                </>
              ) : (
                <>
                  <ShieldOff className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Remove verification
                </>
              )}
            </button>
          </ModalFooter>
        </Modal>
      </>
    );
  }

  // ── Unverified state: green Verify button + confirm modal ──
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
