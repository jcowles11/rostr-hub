"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Plus, MessageSquare, Megaphone } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { comingSoon } from "@/lib/coming-soon";
import { cn } from "@/lib/utils";
import { InboxList } from "@/components/organisms/inbox-list";
import { NewMessageModal } from "@/components/organisms/new-message-modal";
import { AnnouncementModal } from "@/components/organisms/announcement-modal";
import type { InboxThread } from "@/lib/services/messaging";
import type { RealPlayer } from "@/lib/services/players";

export function CoachInboxView({
  threads,
  roster,
  programName,
  programLevels,
}: {
  threads: InboxThread[];
  roster: RealPlayer[];
  programName: string;
  programLevels: string[];
}) {
  const router = useRouter();
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: programName }, { label: "Messages" }]}
        actions={[
          {
            kind: "icon",
            icon: <Bell className="w-[15px] h-[15px]" />,
            onClick: () => comingSoon("Notifications"),
          },
          {
            kind: "ghost",
            label: "Announce",
            icon: <Megaphone className="w-[15px] h-[15px]" />,
            onClick: () => setAnnOpen(true),
          },
          {
            kind: "primary",
            label: "New message",
            icon: <Plus className="w-[15px] h-[15px]" />,
            onClick: () => setNewMsgOpen(true),
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Messages
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-1">
                Direct messages with players and team-wide announcements.
                {totalUnread > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-red-soft text-red text-[11px] font-bold uppercase tracking-[0.04em]">
                    {totalUnread} unread
                  </span>
                )}
              </p>
            </div>
          </div>

          {threads.length === 0 ? (
            <EmptyState onNewMessage={() => setNewMsgOpen(true)} onAnnounce={() => setAnnOpen(true)} />
          ) : (
            <InboxList
              threads={threads}
              hrefFor={(t) => `/app/messages/${t.threadId}`}
            />
          )}
        </div>
      </div>

      <NewMessageModal
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        roster={roster}
        onSent={(threadId) => {
          setNewMsgOpen(false);
          router.push(`/app/messages/${threadId}`);
        }}
      />
      <AnnouncementModal
        open={annOpen}
        onOpenChange={setAnnOpen}
        levels={programLevels}
        onSent={(threadId) => {
          setAnnOpen(false);
          router.push(`/app/messages/${threadId}`);
        }}
      />
    </>
  );
}

function EmptyState({
  onNewMessage,
  onAnnounce,
}: {
  onNewMessage: () => void;
  onAnnounce: () => void;
}) {
  return (
    <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
        <MessageSquare className="w-6 h-6" />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-tight">
        No messages yet
      </h2>
      <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
        Start a conversation with a player, or broadcast an announcement to a
        team level. Players see messages in their own inbox on{" "}
        <code className="font-mono text-[12px] px-1 bg-paper rounded-xs">/me</code>.
      </p>
      <div className="mt-5 flex gap-2 justify-center">
        <button
          onClick={onNewMessage}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          New message
        </button>
        <button
          onClick={onAnnounce}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-paper hover:bg-paper-deep text-ink rounded-sm text-[13px] font-semibold border border-hair"
        >
          <Megaphone className="w-3.5 h-3.5" />
          Announcement
        </button>
      </div>
    </div>
  );
}

// Silence unused import warnings from scaffolded imports
void Link;
void cn;
