"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Sparkles } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { Button } from "@/components/atoms/button";
import { sendRecruiterOutreachAction } from "@/app/app/messages/actions";
import type { RecruiterQuota } from "@/lib/services/messaging";

/**
 * OutreachComposerModal — recruiter sends a DM-style outreach to a
 * player. Enforces plan quota at the server level; the UI shows a
 * counter + disables when quota is exhausted.
 */
export function OutreachComposerModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  quota,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  playerId: string;
  playerName: string;
  quota: RecruiterQuota;
  onSent?: (threadId: string) => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    `Hi ${playerName.split(" ")[0]},\n\n`,
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const remaining = quota.remaining;
  const exhausted = remaining <= 0;

  const reset = () => {
    setSubject("");
    setBody(`Hi ${playerName.split(" ")[0]},\n\n`);
    setError(null);
  };

  const submit = async () => {
    if (!body.trim()) return setError("Message can't be empty.");
    setSending(true);
    setError(null);
    const r = await sendRecruiterOutreachAction({
      playerId,
      subject,
      body,
    });
    setSending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Outreach sent", {
      description: `${playerName} will see it in their inbox.`,
    });
    reset();
    onOpenChange(false);
    if (r.threadId && onSent) onSent(r.threadId);
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={`Reach out to ${playerName}`}
      description="Your message goes to the player's inbox for them to accept or decline."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Quota indicator */}
        <div className="flex items-center gap-2 p-3 bg-paper border border-hair-2 rounded-sm">
          <Sparkles className="w-4 h-4 text-red shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold">
              {remaining} of {quota.monthlyLimit} outreach messages remaining
            </div>
            <div className="text-[11px] text-ink-3 mt-0.5">
              Plan: <span className="uppercase font-mono">{quota.plan}</span> ·
              resets on{" "}
              {new Date(quota.monthResetAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {exhausted ? (
          <div className="p-4 bg-red-soft rounded-sm text-[12.5px] text-red">
            <b>You&apos;ve used all your outreach for this month.</b> Your quota
            resets on{" "}
            {new Date(quota.monthResetAt).toLocaleDateString()} — or upgrade
            your plan for more messages.
          </div>
        ) : (
          <>
            <div>
              <div className="type-label mb-1.5">Subject (optional)</div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Interest from University of Texas"
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
              />
            </div>
            <div>
              <div className="type-label mb-1.5">Message</div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft resize-none"
              />
              <div className="text-[11px] text-ink-3 mt-1">
                Personalize it. Mention a specific stat or game you saw. Generic
                messages get declined.
              </div>
            </div>
          </>
        )}

        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={exhausted || !body.trim() || sending}
          >
            {sending ? "Sending…" : exhausted ? "Quota exhausted" : "Send outreach"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
