"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Paperclip, Send, Bell } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar, type AvatarColor } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";

/**
 * /app/messages/[id] — Thread detail.
 * Stub conversation UI with a composer. Send action fires a toast.
 */
interface Message {
  id: string;
  who: "me" | "them";
  body: string;
  time: string;
}

const THREADS: Record<
  string,
  {
    who: string;
    role: string;
    avatar: string;
    color: AvatarColor;
    messages: Message[];
  }
> = {
  t1: {
    who: "Ellen Johnson",
    role: "Parent · Marcus Johnson",
    avatar: "EJ",
    color: "dirt",
    messages: [
      { id: "1", who: "them", body: "Hi coach — Marcus has a doctor's note for the hamstring issue. Should I send it to you or the trainer?", time: "9:42 AM" },
      { id: "2", who: "them", body: "Also he's cleared for throwing, no running sprints until Monday.", time: "9:43 AM" },
    ],
  },
  t2: {
    who: "Team · Parents",
    role: "Broadcast · 24 parents",
    avatar: "P",
    color: "sky",
    messages: [
      { id: "1", who: "me", body: "Reminder, game Friday 5 PM home field. Bus leaves at 3:45 for away Saturday.", time: "Yesterday, 2:10 PM" },
    ],
  },
  t3: {
    who: "Coach Rivera",
    role: "Assistant · Baseball",
    avatar: "CR",
    color: "grass",
    messages: [
      { id: "1", who: "them", body: "Can we move infield time to 4:15? I've got a pickup at 6.", time: "Yesterday, 4:18 PM" },
      { id: "2", who: "me", body: "Works for me. Let's plan for 4:15 → 5:00 on IF, then BP stations rotate until 6:00.", time: "Yesterday, 4:22 PM" },
      { id: "3", who: "them", body: "👍 updating the plan now.", time: "Yesterday, 4:24 PM" },
    ],
  },
  t4: { who: "Raj Patel", role: "Parent · Noah Patel", avatar: "RP", color: "red", messages: [{ id: "1", who: "them", body: "Thanks for the update — we'll have him ready for Friday.", time: "Apr 19" }] },
  t5: { who: "UNC Recruiting", role: "Routed via coach (NCAA)", avatar: "UNC", color: "ink", messages: [{ id: "1", who: "them", body: "Coach Martinez, we're interested in learning more about Marcus Johnson. Available for a call Tues or Wed?", time: "Apr 18" }] },
  t6: { who: "Team Athletics Office", role: "Administration", avatar: "AO", color: "gold", messages: [{ id: "1", who: "them", body: "Reminder: all coaches complete background re-check by May 1.", time: "Apr 17" }] },
};

export default function ThreadPage({ params }: { params: { id: string } }) {
  const thread = THREADS[params.id] ?? THREADS.t1;
  const [input, setInput] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    comingSoon("Message sent", "Real threaded messaging + read receipts wire up next.");
    setInput("");
  };

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Messages" }, { label: thread.who }]}
        actions={[{ kind: "icon", icon: <Bell className="w-[15px] h-[15px]" /> }]}
      />
      <div className="flex-1 overflow-hidden flex flex-col bg-paper">
        <div className="border-b border-hair bg-card px-8 py-4 flex items-center gap-4">
          <Link href="/app/messages" className="text-ink-3 hover:text-ink">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Avatar size="md" color={thread.color} initials={thread.avatar} />
          <div>
            <div className="font-semibold text-[14px]">{thread.who}</div>
            <div className="text-[11.5px] text-ink-3">{thread.role}</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-7">
          <div className="max-w-[680px] mx-auto space-y-4">
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-3", m.who === "me" ? "justify-end" : "justify-start")}
              >
                {m.who === "them" && (
                  <Avatar size="sm" color={thread.color} initials={thread.avatar} />
                )}
                <div
                  className={cn(
                    "max-w-[70%] px-4 py-2.5 rounded-lg text-[13.5px] leading-relaxed",
                    m.who === "me"
                      ? "bg-ink text-white rounded-br-sm"
                      : "bg-card border border-hair rounded-bl-sm",
                  )}
                >
                  {m.body}
                  <div
                    className={cn(
                      "mt-1 font-mono text-[10px]",
                      m.who === "me" ? "text-white/50" : "text-ink-3",
                    )}
                  >
                    {m.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSend}
          className="border-t border-hair bg-card px-8 py-4 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => comingSoon("Attach files", "Drag-drop file attachments come with the messaging v2.")}
            className="p-2 text-ink-3 hover:text-ink hover:bg-paper rounded-sm"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${thread.who}…`}
            className="flex-1 bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red disabled:opacity-40 text-white rounded-sm text-[13px] font-semibold"
          >
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </form>
      </div>
    </>
  );
}
