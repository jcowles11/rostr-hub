"use client";

import Link from "next/link";
import { Megaphone, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/lib/services/messaging";

/**
 * InboxList — shared list component used by both the coach inbox and
 * athlete inbox. Renders a thread card per row with kind icon, unread
 * indicator, counterparty name, preview, and relative time.
 */
export function InboxList({
  threads,
  hrefFor,
  emptyLabel = "No threads",
}: {
  threads: InboxThread[];
  hrefFor: (t: InboxThread) => string;
  emptyLabel?: string;
}) {
  if (threads.length === 0) {
    return (
      <div className="bg-card border border-hair rounded-lg p-6 text-center text-[13px] text-ink-3">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      {threads.map((t, i) => (
        <ThreadRow
          key={t.threadId}
          thread={t}
          href={hrefFor(t)}
          isLast={i === threads.length - 1}
        />
      ))}
    </div>
  );
}

function ThreadRow({
  thread,
  href,
  isLast,
}: {
  thread: InboxThread;
  href: string;
  isLast: boolean;
}) {
  const initials = getInitials(thread.counterparty?.displayName ?? "");
  const pendingOutreach =
    thread.kind === "recruiter_outreach" && thread.outreachStatus === "pending";
  const declinedOutreach =
    thread.kind === "recruiter_outreach" && thread.outreachStatus === "declined";

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 sm:px-[18px] py-3 hover:bg-paper transition-colors",
        !isLast && "border-b border-hair-2",
        thread.unreadCount > 0 && "bg-red-soft/20",
      )}
    >
      {/* Kind + avatar */}
      <div className="relative shrink-0">
        <Avatar
          size="md"
          color={(thread.counterparty?.avatarColor ?? "ink") as "ink"}
          initials={initials}
        />
        {thread.kind === "announcement" && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-ink text-white flex items-center justify-center">
            <Megaphone className="w-2.5 h-2.5" />
          </span>
        )}
        {thread.kind === "recruiter_outreach" && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-sky text-white flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "text-[13.5px] truncate",
              thread.unreadCount > 0 ? "font-bold text-ink" : "font-semibold text-ink-2",
            )}
          >
            {thread.counterparty?.displayName ?? "Unknown"}
          </span>
          {pendingOutreach && (
            <span className="text-[9.5px] font-bold text-amber bg-amber-soft px-1.5 py-0.5 rounded-xs uppercase tracking-[0.06em]">
              Pending
            </span>
          )}
          {declinedOutreach && (
            <span className="text-[9.5px] font-bold text-ink-3 bg-paper-deep px-1.5 py-0.5 rounded-xs uppercase tracking-[0.06em]">
              Declined
            </span>
          )}
          {thread.kind === "announcement" && (
            <span className="text-[9.5px] font-bold text-ink-3 bg-paper-deep px-1.5 py-0.5 rounded-xs uppercase tracking-[0.06em] inline-flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> Announcement
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-ink-3 mt-0.5 truncate">
          {thread.counterparty?.subLabel ?? ""}
        </div>
        <div
          className={cn(
            "text-[12px] mt-1 truncate",
            thread.unreadCount > 0 ? "text-ink font-medium" : "text-ink-2",
          )}
        >
          {thread.preview ?? <em className="text-ink-4">No messages yet</em>}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="font-mono text-[10.5px] text-ink-4">
          {formatRelative(thread.lastMessageAt)}
        </span>
        {thread.unreadCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red text-white text-[10px] font-bold px-1">
            {thread.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
