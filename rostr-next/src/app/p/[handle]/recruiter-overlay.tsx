"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import {
  Heart,
  Check,
  Plus,
  Eye,
  TrendingUp,
  Sparkles,
  ChevronDown,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecruiterContext, RecruiterList } from "@/lib/services/recruiter";
import type { RecruiterQuota } from "@/lib/services/messaging";
import {
  togglePlayerInListAction,
  createListAction,
  trackPlayerViewAction,
} from "@/app/scout/actions";
import { OutreachComposerModal } from "@/components/organisms/outreach-composer-modal";

/**
 * RecruiterOverlay — shown on /p/[handle] when viewer is a recruiter.
 * Adds:
 *   - "Saved to N lists" summary + one-click save to more lists
 *   - Profile view stats (viewers in last 30d, last 7d)
 *   - AI similar-players trigger (v2)
 *
 * Sits below the Hero and above the tabs so it's discoverable but
 * doesn't interrupt the athlete's identity card.
 */
export function RecruiterOverlay({
  recruiter: _recruiter,
  playerId,
  playerName,
  lists,
  memberListIds,
  viewStats,
  quota,
  outreachExists,
}: {
  recruiter: RecruiterContext;
  playerId: string;
  playerName: string;
  lists: RecruiterList[];
  memberListIds: string[];
  viewStats: { viewers30d: number; views30d: number; viewers7d: number } | null;
  quota: RecruiterQuota;
  outreachExists: boolean;
}) {
  const memberSet = new Set(memberListIds);
  const [outreachOpen, setOutreachOpen] = useState(false);

  return (
    <>
      <div className="mt-4 bg-card border border-hair rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-red shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          Recruiter tools
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-2.5 sm:gap-4">
          <SaveWidget
            playerId={playerId}
            playerName={playerName}
            lists={lists}
            memberSet={memberSet}
          />
          <button
            onClick={() => setOutreachOpen(true)}
            disabled={outreachExists || quota.remaining <= 0}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[12.5px] font-semibold transition-colors",
              outreachExists
                ? "bg-paper text-ink-3 border border-hair-2"
                : quota.remaining <= 0
                  ? "bg-paper text-ink-3 border border-hair-2 cursor-not-allowed"
                  : "bg-ink hover:bg-red text-white",
            )}
            title={
              outreachExists
                ? "You've already reached out"
                : quota.remaining <= 0
                  ? "Quota exhausted"
                  : `${quota.remaining} messages left this month`
            }
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            {outreachExists ? "Already messaged" : "Message"}
          </button>
          {viewStats && (
            <ViewStat
              label={`${viewStats.viewers30d} viewer${viewStats.viewers30d === 1 ? "" : "s"} · 30d`}
              icon={<Eye className="w-3.5 h-3.5" />}
            />
          )}
          {viewStats && viewStats.viewers7d > 0 && (
            <ViewStat
              label={`${viewStats.viewers7d} this week`}
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              tone="grass"
            />
          )}
        </div>
      </div>

      <OutreachComposerModal
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        playerId={playerId}
        playerName={playerName}
        quota={quota}
      />
    </>
  );
}

function ViewStat({
  label,
  icon,
  tone = "ink",
}: {
  label: string;
  icon: React.ReactNode;
  tone?: "ink" | "grass";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] font-mono font-semibold",
        tone === "grass" ? "text-grass" : "text-ink-3",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function SaveWidget({
  playerId,
  playerName,
  lists,
  memberSet,
}: {
  playerId: string;
  playerName: string;
  lists: RecruiterList[];
  memberSet: Set<string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newListName, setNewListName] = useState("");
  const [newListOpen, setNewListOpen] = useState(false);

  const savedCount = memberSet.size;

  const toggle = (listId: string, currentlyIn: boolean) => {
    startTransition(async () => {
      const r = await togglePlayerInListAction(listId, playerId, !currentlyIn);
      if (r.error) toast.error("Couldn't update", { description: r.error });
      else {
        toast.success(currentlyIn ? "Removed" : `Saved ${playerName.split(" ")[0]}`);
        router.refresh();
      }
    });
  };

  const createAndSave = async () => {
    if (!newListName.trim()) return;
    const r = await createListAction({ name: newListName });
    if (r.error || !r.listId) return toast.error("Couldn't create list");
    await togglePlayerInListAction(r.listId, playerId, true);
    toast.success(`Saved to ${newListName}`);
    setNewListName("");
    setNewListOpen(false);
    router.refresh();
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[12.5px] font-semibold transition-colors",
            savedCount > 0
              ? "bg-red-soft text-red border border-red"
              : "bg-ink hover:bg-red text-white",
            isPending && "opacity-60",
          )}
        >
          <Heart className={cn("w-3.5 h-3.5", savedCount > 0 && "fill-red")} />
          {savedCount > 0
            ? `Saved · ${savedCount} list${savedCount === 1 ? "" : "s"}`
            : "Save to list"}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal min-w-[260px] py-1"
        >
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Save to list
          </div>
          {lists.length === 0 && !newListOpen && (
            <div className="px-3 py-2 text-[11.5px] text-ink-3">No lists yet.</div>
          )}
          {lists.map((l) => {
            const saved = memberSet.has(l.id);
            return (
              <button
                key={l.id}
                onClick={() => toggle(l.id, saved)}
                disabled={isPending}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-paper flex items-center gap-2"
              >
                <span className="text-[13px] w-4">{l.emoji ?? "•"}</span>
                <span className="flex-1 truncate">{l.name}</span>
                {saved && <Check className="w-3.5 h-3.5 text-grass" />}
                <span className="font-mono text-[10px] text-ink-3 w-6 text-right">
                  {l.playerCount}
                </span>
              </button>
            );
          })}
          {newListOpen ? (
            <div className="px-3 py-2 border-t border-hair-2">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createAndSave();
                  if (e.key === "Escape") setNewListOpen(false);
                }}
                placeholder="New list name…"
                className="w-full bg-paper border border-hair rounded-sm px-2 py-1.5 text-[12.5px] outline-none focus:border-red"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setNewListOpen(false)}
                  className="text-[11.5px] text-ink-3 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={createAndSave}
                  disabled={!newListName.trim()}
                  className="text-[11.5px] bg-red text-white px-2.5 py-1 rounded-xs font-semibold disabled:opacity-50"
                >
                  Create + save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNewListOpen(true)}
              className="w-full text-left px-3 py-2 text-[12.5px] text-red font-semibold hover:bg-red-soft border-t border-hair-2 flex items-center gap-2"
            >
              <Plus className="w-3 h-3" /> New list
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * RecruiterViewTracker — fire-and-forget client component that logs
 * a view record once per page load when the current viewer is a
 * recruiter. Deliberately no UI.
 */
export function RecruiterViewTracker({ playerId }: { playerId: string }) {
  useEffect(() => {
    trackPlayerViewAction(playerId).catch(() => {
      /* ignore */
    });
  }, [playerId]);
  return null;
}
