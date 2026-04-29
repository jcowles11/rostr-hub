"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Search } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { Button } from "@/components/atoms/button";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { createCoachPlayerDmAction } from "@/app/app/messages/actions";
import type { RealPlayer } from "@/lib/services/players";

/**
 * NewMessageModal — coach composes a DM to a player.
 * Step 1: pick a player (search)
 * Step 2: write message + send
 */
export function NewMessageModal({
  open,
  onOpenChange,
  roster,
  onSent,
  initialPlayerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roster: RealPlayer[];
  onSent: (threadId: string) => void;
  initialPlayerId?: string;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    initialPlayerId ?? null,
  );
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster.slice(0, 60);
    return roster
      .filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [roster, query]);

  const selected = roster.find((p) => p.id === selectedPlayerId) ?? null;

  const reset = () => {
    setSelectedPlayerId(initialPlayerId ?? null);
    setQuery("");
    setBody("");
    setError(null);
  };

  const submit = async () => {
    if (!selected) {
      setError("Pick a player first.");
      return;
    }
    if (!body.trim()) {
      setError("Write a message.");
      return;
    }
    setSending(true);
    setError(null);
    const r = await createCoachPlayerDmAction({
      playerId: selected.id,
      body,
    });
    setSending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(`Message sent to ${selected.firstName}`);
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
      title="New message"
      description="DM a player directly. They'll see it in their Rostr inbox."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!selected ? (
          <>
            <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2 focus-within:border-red">
              <Search className="w-4 h-4 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your roster…"
                className="flex-1 bg-transparent outline-none text-[13.5px]"
                autoFocus
              />
            </div>
            <div className="border border-hair rounded-sm overflow-hidden max-h-[300px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-[12.5px] text-ink-3 text-center">No matches</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayerId(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 border-b border-hair-2 last:border-b-0 hover:bg-paper text-left"
                  >
                    <Avatar size="sm" color={p.avatarColor} initials={p.initials} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="font-mono text-[10.5px] text-ink-3 truncate">
                        {p.classYear}
                        {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ""}
                        {p.positions.length > 0 ? ` · ${p.positions.join("/")}` : ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-paper rounded-sm border border-hair-2">
              <Avatar size="md" color={selected.avatarColor} initials={selected.initials} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold">
                  {selected.firstName} {selected.lastName}
                </div>
                <div className="font-mono text-[10.5px] text-ink-3">
                  {selected.classYear}
                  {selected.jerseyNumber ? ` · #${selected.jerseyNumber}` : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayerId(null)}
                className="text-[11.5px] text-ink-3 hover:text-ink"
              >
                Change
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Your message…"
              rows={6}
              autoFocus
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft resize-none"
            />
            <p className="text-[11px] text-ink-3">
              {selected.profileStatus === "linked"
                ? "✓ They've claimed their profile — they'll get this message immediately."
                : "⚠ They haven't claimed their Rostr profile yet. The message sends once they do."}
            </p>
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
            disabled={!selected || !body.trim() || sending}
          >
            {sending ? "Sending…" : "Send message"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

void cn;
