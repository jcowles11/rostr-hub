"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Megaphone,
  Bell,
  Check,
  X,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { comingSoon } from "@/lib/coming-soon";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ChatMessage,
  InboxThread,
  ThreadParticipant,
} from "@/lib/services/messaging";
import {
  sendMessageAction,
  respondToOutreachAction,
} from "@/app/app/messages/actions";

/**
 * ThreadDetailView — shared message thread UI.
 *
 * Renders the thread header, a scrolling message list, and a composer.
 * Handles:
 *   - Realtime updates via Supabase channels (new messages appended live)
 *   - Recruiter outreach status: if the viewer is the target player and
 *     the thread is pending, the composer is replaced with Accept / Decline
 *   - Declined outreach: read-only
 */
export function ThreadDetailView({
  thread,
  initialMessages,
  participants,
  programName,
  backHref,
  backLabel,
}: {
  thread: InboxThread;
  initialMessages: ChatMessage[];
  participants: ThreadParticipant[];
  programName: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [respondingTo, setRespondingTo] = useState<"accepted" | "declined" | null>(null);
  const [status, setStatus] = useState(thread.outreachStatus);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  // Track my own user id for "is this my message" check
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setSelfUserId(data.user?.id ?? null);
    });
  }, []);

  // Auto-scroll to newest message whenever the list grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Realtime: subscribe to new messages on this thread
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`thread:${thread.threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${thread.threadId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            thread_id: string;
            sender_user_id: string;
            body: string;
            created_at: string;
            edited_at: string | null;
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                threadId: row.thread_id,
                senderUserId: row.sender_user_id,
                body: row.body,
                createdAt: row.created_at,
                editedAt: row.edited_at,
              },
            ];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread.threadId]);

  const pending = thread.kind === "recruiter_outreach" && status === "pending";
  const declined = thread.kind === "recruiter_outreach" && status === "declined";
  const isTargetPlayer =
    thread.kind === "recruiter_outreach" &&
    thread.viewerRole === "player" &&
    thread.targetPlayerId != null;
  const canSend = !declined && !(pending && !isRecruiterViewer(thread));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const r = await sendMessageAction(thread.threadId, body);
    setSending(false);
    if (r.error) {
      toast.error("Couldn't send", { description: r.error });
      return;
    }
    setBody("");
    // Optimistic append — realtime will de-dupe
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        threadId: thread.threadId,
        senderUserId: selfUserId,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        editedAt: null,
      },
    ]);
  };

  const respond = async (decision: "accepted" | "declined") => {
    setRespondingTo(decision);
    const r = await respondToOutreachAction(thread.threadId, decision);
    setRespondingTo(null);
    if (r.error) {
      toast.error("Couldn't respond", { description: r.error });
      return;
    }
    setStatus(decision);
    toast.success(
      decision === "accepted"
        ? "Outreach accepted — reply to start the conversation"
        : "Outreach declined",
    );
    startTransition(() => router.refresh());
  };

  const headerTitle = thread.counterparty?.displayName ?? "Conversation";
  const headerSub = thread.counterparty?.subLabel ?? "";

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: backLabel, href: backHref },
          { label: headerTitle },
        ]}
        // PHASE 5 — removed Notifications bell.
        actions={[]}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-[720px] w-full mx-auto flex-1 flex flex-col min-h-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mt-4 ml-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {backLabel.toLowerCase()}
          </Link>

          {/* Thread header */}
          <div className="px-4 sm:px-6 py-4 border-b border-hair-2 flex items-center gap-3">
            <Avatar
              size="lg"
              color={(thread.counterparty?.avatarColor ?? "ink") as "ink"}
              initials={getInitials(headerTitle)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-display text-[18px] font-semibold tracking-tight truncate">
                  {headerTitle}
                </div>
                {thread.kind === "announcement" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-2 bg-paper-deep px-1.5 py-0.5 rounded-xs uppercase tracking-[0.06em]">
                    <Megaphone className="w-2.5 h-2.5" /> Announcement
                  </span>
                )}
                {thread.kind === "recruiter_outreach" && status && (
                  <OutreachBadge status={status} />
                )}
              </div>
              {headerSub && (
                <div className="font-mono text-[11px] text-ink-3 truncate">
                  {headerSub}
                </div>
              )}
              {thread.subject && (
                <div className="mt-1 text-[12.5px] text-ink-2 truncate">
                  Subject: {thread.subject}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3"
          >
            {messages.map((m) => {
              const isSelf = m.senderUserId != null && m.senderUserId === selfUserId;
              const sender = participants.find((p) => p.userId === m.senderUserId);
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isSelf={isSelf}
                  senderName={sender?.displayName ?? "Unknown"}
                />
              );
            })}
          </div>

          {/* Composer / outreach response */}
          <div className="border-t border-hair bg-card px-4 sm:px-6 py-3">
            {pending && isTargetPlayer ? (
              <div className="space-y-2">
                <div className="text-[12.5px] text-ink-2 text-center">
                  <b>{thread.counterparty?.displayName ?? "A recruiter"}</b> reached out. Accept to start a conversation, or decline to silently archive.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond("accepted")}
                    disabled={respondingTo !== null}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-[42px] bg-grass hover:bg-grass/90 text-white rounded-sm text-[13px] font-semibold disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    {respondingTo === "accepted" ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    onClick={() => respond("declined")}
                    disabled={respondingTo !== null}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-[42px] bg-paper hover:bg-paper-deep text-ink-2 rounded-sm text-[13px] font-semibold border border-hair disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                    {respondingTo === "declined" ? "Declining…" : "Decline"}
                  </button>
                </div>
              </div>
            ) : declined ? (
              <div className="text-center py-3 text-[12.5px] text-ink-3">
                This outreach was declined. The conversation is closed.
              </div>
            ) : pending && isRecruiterViewer(thread) ? (
              <div className="text-center py-3 text-[12.5px] text-ink-3">
                Waiting for the player to accept your outreach.
              </div>
            ) : canSend ? (
              <form onSubmit={send} className="flex gap-2 items-end">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      send(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Write a message… (Cmd+Enter to send)"
                  rows={2}
                  className="flex-1 bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft resize-none"
                />
                <button
                  type="submit"
                  disabled={!body.trim() || sending}
                  className="shrink-0 inline-flex items-center justify-center w-10 h-10 bg-red hover:bg-red/90 disabled:bg-red/40 text-white rounded-sm"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function isRecruiterViewer(thread: InboxThread): boolean {
  return thread.viewerRole === "recruiter";
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

function OutreachBadge({ status }: { status: "pending" | "accepted" | "declined" }) {
  const map = {
    pending: { bg: "bg-amber-soft", fg: "text-amber", label: "Pending" },
    accepted: { bg: "bg-grass-dim", fg: "text-grass", label: "Accepted" },
    declined: { bg: "bg-paper-deep", fg: "text-ink-3", label: "Declined" },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.06em]",
        s.bg,
        s.fg,
      )}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {s.label}
    </span>
  );
}

function MessageBubble({
  message,
  isSelf,
  senderName,
}: {
  message: ChatMessage;
  isSelf: boolean;
  senderName: string;
}) {
  return (
    <div className={cn("flex gap-2", isSelf && "flex-row-reverse")}>
      {!isSelf && (
        <Avatar size="sm" color="ink" initials={getInitials(senderName)} />
      )}
      <div className={cn("max-w-[75%] flex flex-col", isSelf && "items-end")}>
        {!isSelf && (
          <div className="text-[10.5px] font-semibold text-ink-3 mb-0.5 px-1">
            {senderName}
          </div>
        )}
        <div
          className={cn(
            "px-3 py-2 rounded-md text-[13.5px] leading-relaxed whitespace-pre-wrap break-words",
            isSelf ? "bg-red text-white" : "bg-card border border-hair",
          )}
        >
          {message.body}
        </div>
        <div
          className={cn(
            "font-mono text-[10px] text-ink-4 mt-0.5 px-1",
            isSelf && "text-right",
          )}
        >
          {formatMessageTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
