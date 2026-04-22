"use client";

import Link from "next/link";
import { MessageSquare, Plus, Bell } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";

/**
 * /app/messages — Inbox stub. Threaded view comes later.
 */
const THREADS = [
  { id: "t1", who: "Ellen Johnson", role: "Parent · Marcus Johnson", avatar: "EJ", color: "dirt" as const, preview: "Hi coach — Marcus has a doctor's note for the hamstring issue. Should I send it to you or the trainer?", time: "9:42 AM", unread: true },
  { id: "t2", who: "Team · Parents", role: "Broadcast · 24 parents", avatar: "P", color: "sky" as const, preview: "You: Reminder, game Friday 5 PM home field. Bus leaves at 3:45 for away Saturday.", time: "Yesterday", unread: false },
  { id: "t3", who: "Coach Rivera (asst)", role: "Assistant · Baseball", avatar: "CR", color: "grass" as const, preview: "Can we move infield time to 4:15? I've got a pickup at 6.", time: "Yesterday", unread: true },
  { id: "t4", who: "Raj Patel", role: "Parent · Noah Patel", avatar: "RP", color: "red" as const, preview: "Thanks for the update — we'll have him ready for Friday.", time: "Apr 19", unread: false },
  { id: "t5", who: "UNC Recruiting", role: "Routed via coach (NCAA)", avatar: "UNC", color: "ink" as const, preview: "Coach Martinez, we're interested in learning more about Marcus Johnson. Available for a call Tues or Wed?", time: "Apr 18", unread: false },
  { id: "t6", who: "Team Athletics Office", role: "Administration", avatar: "AO", color: "gold" as const, preview: "Reminder: all coaches complete background re-check by May 1.", time: "Apr 17", unread: false },
];

export default function MessagesPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Messages" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" /> },
          {
            kind: "primary",
            label: "New message",
            icon: <Plus className="w-[15px] h-[15px]" />,
            onClick: () => comingSoon("New message", "Compose + broadcast to team / parents / recruiter lands next."),
          },
        ]}
      />
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[360px_1fr] h-full">
          <div className="border-r border-hair bg-card">
            <div className="px-4 pt-5 pb-3 border-b border-hair-2">
              <h1 className="font-display text-[22px] font-semibold tracking-tight">Messages</h1>
              <div className="flex gap-1 mt-3">
                {["All", "Parents", "Players", "Recruiters"].map((t, i) => (
                  <button
                    key={t}
                    className={cn(
                      "px-3 py-1.5 rounded-xs text-[12px] font-semibold",
                      i === 0 ? "bg-paper text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {THREADS.map((t) => (
              <Link
                key={t.id}
                href={`/app/messages/${t.id}`}
                className={cn(
                  "flex gap-3 px-4 py-3.5 border-b border-hair-2 cursor-pointer",
                  t.id === "t1" ? "bg-paper" : "hover:bg-paper",
                )}
              >
                <Avatar size="md" color={t.color} initials={t.avatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-semibold truncate">{t.who}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-ink-4 shrink-0">
                      {t.time}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-ink-3 font-medium mt-0.5">{t.role}</div>
                  <div className="text-[12.5px] text-ink-2 mt-1 line-clamp-2">{t.preview}</div>
                </div>
                {t.unread && <span className="w-1.5 h-1.5 rounded-full bg-red mt-2 shrink-0" />}
              </Link>
            ))}
          </div>
          <div className="p-10 flex items-center justify-center text-center">
            <div>
              <div className="w-16 h-16 rounded-xl bg-paper-deep text-ink-3 flex items-center justify-center mx-auto mb-5">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="font-display text-[22px] font-semibold tracking-tight">
                Select a thread
              </div>
              <p className="text-[13.5px] text-ink-3 mt-2 max-w-[400px]">
                Full threaded messaging, read receipts, and broadcast composer come in the
                next sprint.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
