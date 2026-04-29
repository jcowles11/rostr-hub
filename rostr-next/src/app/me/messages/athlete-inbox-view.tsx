"use client";

import { useState } from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { InboxList } from "@/components/organisms/inbox-list";
import type { InboxThread } from "@/lib/services/messaging";

/**
 * AthleteInboxView — two-tab inbox.
 *
 * Messages tab = normal DMs + announcements + accepted outreach
 * Requests tab = pending recruiter outreach the athlete hasn't responded to
 */
export function AthleteInboxView({ threads }: { threads: InboxThread[] }) {
  const [tab, setTab] = useState<"messages" | "requests">("messages");

  const requests = threads.filter(
    (t) => t.kind === "recruiter_outreach" && t.outreachStatus === "pending",
  );
  const messages = threads.filter(
    (t) =>
      t.kind !== "recruiter_outreach" ||
      (t.outreachStatus === "accepted" && t.outreachStatus !== undefined),
  );

  const requestUnread = requests.length; // Each pending request counts as unread attention
  const messageUnread = messages.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <>
      <div className="flex gap-0.5 mb-4 border-b border-hair">
        <TabButton
          active={tab === "messages"}
          onClick={() => setTab("messages")}
          label="Inbox"
          badge={messageUnread}
          icon={<MessageSquare className="w-3.5 h-3.5" />}
        />
        <TabButton
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          label="Requests"
          badge={requestUnread}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          accent
        />
      </div>

      {tab === "messages" && (
        <>
          {messages.length === 0 ? (
            <EmptyMessages />
          ) : (
            <InboxList
              threads={messages}
              hrefFor={(t) => `/me/messages/${t.threadId}`}
            />
          )}
        </>
      )}
      {tab === "requests" && (
        <>
          <div className="mb-3 p-3 bg-paper border border-hair-2 rounded-sm text-[12px] text-ink-3 leading-relaxed">
            College coaches who reach out directly land here first. Accept to
            start a conversation, or decline to silently close the thread. Your
            coach is <b className="text-ink-2">not notified either way</b>.
          </div>
          {requests.length === 0 ? (
            <EmptyRequests />
          ) : (
            <InboxList
              threads={requests}
              hrefFor={(t) => `/me/messages/${t.threadId}`}
            />
          )}
        </>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
  icon,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 sm:px-4 py-2.5 -mb-px text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-colors",
        active
          ? accent
            ? "text-red border-red"
            : "text-ink border-ink"
          : "text-ink-3 border-transparent hover:text-ink",
      )}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1",
            accent ? "bg-red text-white" : "bg-ink text-white",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyMessages() {
  return (
    <div className="p-8 bg-card border border-dashed border-hair rounded-lg text-center">
      <MessageSquare className="w-6 h-6 text-ink-4 mx-auto" />
      <div className="mt-2 font-display text-[16px] font-semibold tracking-tight">
        No messages yet
      </div>
      <div className="text-[12.5px] text-ink-3 mt-1 max-w-[320px] mx-auto leading-relaxed">
        Your coach will send team announcements and direct messages here.
      </div>
    </div>
  );
}

function EmptyRequests() {
  return (
    <div className="p-8 bg-card border border-dashed border-hair rounded-lg text-center">
      <Sparkles className="w-6 h-6 text-red mx-auto" />
      <div className="mt-2 font-display text-[16px] font-semibold tracking-tight">
        No recruiter requests
      </div>
      <div className="text-[12.5px] text-ink-3 mt-1 max-w-[320px] mx-auto leading-relaxed">
        When a college coach reaches out directly, you&apos;ll see it here. Keep your
        verified measurables up to date to get noticed.
      </div>
    </div>
  );
}
