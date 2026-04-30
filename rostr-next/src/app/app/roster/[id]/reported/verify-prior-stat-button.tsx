"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldQuestion, ShieldOff, Loader2 } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import {
  verifyPriorStatAction,
  unverifyPriorStatAction,
} from "./actions";

/**
 * VerifyPriorStatButton — coach-side verify / unverify control for a
 * single prior-season stat row. Mirrors VerifyHighlightButton's UX:
 * confirmation modal, pending spinner, success toast, router.refresh.
 *
 * The two flows share one component because the visual context is
 * identical — a per-row pill at the right edge of each prior-season
 * card. `alreadyVerified` picks the visual variant + which action
 * runs on confirm.
 */
export function VerifyPriorStatButton({
  playerId,
  priorStatId,
  seasonLabel,
  alreadyVerified,
  verifiedByName,
  verifiedAt,
}: {
  playerId: string;
  priorStatId: string;
  /** Display name for the row in the modal — usually `season` field. */
  seasonLabel: string;
  alreadyVerified: boolean;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const action = alreadyVerified
        ? unverifyPriorStatAction
        : verifyPriorStatAction;
      const res = await action(playerId, priorStatId);
      if (res.error) {
        toast.error(
          alreadyVerified ? "Couldn't unverify" : "Couldn't verify",
          { description: res.error },
        );
        return;
      }
      toast.success(
        alreadyVerified ? "Verification removed" : "Prior season verified",
        {
          description:
            seasonLabel ||
            (alreadyVerified
              ? "The row is back in player-reported state."
              : "The row now shows the Verified badge publicly."),
        },
      );
      setOpen(false);
      router.refresh();
    });
  }

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
          description="The row will revert to player-reported state."
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-hair bg-paper-deep px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
                Prior season
              </div>
              <div className="font-display text-[14px] font-semibold tracking-tight">
                {seasonLabel || "Untitled season"}
              </div>
              {(verifiedByName || verifiedAt) && (
                <div className="mt-2 text-[11px] text-ink-3 leading-snug">
                  {verifiedByName && (
                    <>
                      Verified by{" "}
                      <span className="font-semibold text-ink-2">
                        {verifiedByName}
                      </span>
                    </>
                  )}
                  {verifiedByName && verifiedAt && " · "}
                  {verifiedAt && new Date(verifiedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <p className="text-[12.5px] text-ink-2 leading-relaxed">
              The row will lose the Verified badge on the player&apos;s public
              profile, and the player will be able to edit or delete it again.
            </p>
            <p className="text-[11.5px] text-ink-3 leading-snug flex items-start gap-2">
              <ShieldQuestion className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Use this if you verified the wrong row or the player&apos;s
                claim turned out to be inaccurate.
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
        title="Verify this prior season?"
        description="You are confirming this stat line is accurate."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-hair bg-paper-deep px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
              Prior season
            </div>
            <div className="font-display text-[14px] font-semibold tracking-tight">
              {seasonLabel || "Untitled season"}
            </div>
          </div>
          <p className="text-[12.5px] text-ink-2 leading-relaxed">
            Once verified, this row will display a{" "}
            <span className="inline-flex items-center gap-1 align-baseline rounded-full bg-grass-dim text-grass border border-grass/20 px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-[0.06em]">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>{" "}
            badge on the player&apos;s public profile, and the player will
            no longer be able to edit or delete it from their editor.
          </p>
          <p className="text-[11.5px] text-ink-3 leading-snug flex items-start gap-2">
            <ShieldQuestion className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Only verify stat lines you can vouch for. A coach signature
              is the trust signal recruiters rely on.
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
