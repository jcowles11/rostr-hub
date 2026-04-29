"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Megaphone } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { sendTeamAnnouncementAction } from "@/app/app/messages/actions";

/**
 * AnnouncementModal — broadcast a message to all (claimed) players on
 * a team level, or every player across the program.
 */
export function AnnouncementModal({
  open,
  onOpenChange,
  levels,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  levels: string[];
  onSent: (threadId: string) => void;
}) {
  const [teamLevel, setTeamLevel] = useState<string | null>(null); // null = all teams
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const reset = () => {
    setTeamLevel(null);
    setSubject("");
    setBody("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!subject.trim()) return setError("Give it a subject.");
    if (!body.trim()) return setError("Write a message.");
    setSending(true);
    const r = await sendTeamAnnouncementAction({
      teamLevel,
      subject,
      body,
    });
    setSending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Announcement sent");
    reset();
    if (r.threadId) onSent(r.threadId);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title="Team announcement"
      description="Broadcast to every claimed player on a team. They see it in their inbox."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <div className="type-label mb-2">Audience</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTeamLevel(null)}
              className={cn(
                "px-3 py-1.5 rounded-xs text-[12px] font-semibold border",
                teamLevel === null
                  ? "bg-red text-white border-red"
                  : "bg-paper text-ink-2 border-hair hover:border-ink-3",
              )}
            >
              Everyone
            </button>
            {levels.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setTeamLevel(lvl)}
                className={cn(
                  "px-3 py-1.5 rounded-xs text-[12px] font-semibold border",
                  teamLevel === lvl
                    ? "bg-red text-white border-red"
                    : "bg-paper text-ink-2 border-hair hover:border-ink-3",
                )}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="type-label mb-1.5">Subject</div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Practice moved to 4pm Thursday"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
          />
        </div>

        <div>
          <div className="type-label mb-1.5">Message</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement…"
            rows={6}
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft resize-none"
          />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-sm bg-paper border border-hair-2 text-[11.5px] text-ink-3 leading-relaxed">
          <Megaphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-3" />
          <span>
            Only players who have <b className="text-ink-2">claimed their Rostr profile</b>
            {" "}will receive this. Send claim links from the roster first if needed.
          </span>
        </div>

        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={!subject.trim() || !body.trim() || sending}
          >
            {sending ? "Sending…" : "Send announcement"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
