import Link from "next/link";
import { Mail, Search, Plus } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar, type AvatarColor } from "@/components/atoms/avatar";
import { MOCK_TEAM } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /demo/messages — coach inbox tour view.
 *
 * Built parallel to /app/messages because the real CoachInboxView
 * relies on real recipient pickers + roster lookups + Supabase write
 * paths. The demo mirror shows the same conversation patterns
 * (parent message, team broadcast, assistant coach DM) without
 * any of the wiring.
 */

export const metadata = {
  title: "Messages · Demo · Rostr",
  robots: { index: false, follow: false },
};

interface DemoThread {
  id: string;
  authorName: string;
  initials: string;
  color: AvatarColor;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  kind: "parent" | "broadcast" | "coach" | "system";
}

// Inbox cross-checks roster state. Anita Patel = Noah Patel's mom
// (Noah is questionable with a wrist tweak in MOCK_PLAYERS); the TCU
// recruiter follow-up matches Jordan Kim's actual recruiting list
// (TCU is one of his three watching schools); Coach Rivera's question
// is about Tuesday — the day after "today" (Mon Apr 27).
const MOCK_THREADS: DemoThread[] = [
  {
    id: "t1",
    authorName: "Anita Patel",
    initials: "AP",
    color: "dirt",
    subject: "Noah — doctor's note",
    preview:
      "Hi coach — Noah's wrist needs another rest day. Doc says no BP til Wednesday's recheck, but he's still good to play Friday. PDF attached…",
    time: "9:42 AM",
    unread: true,
    kind: "parent",
  },
  {
    id: "t2",
    authorName: "Coach Rivera (asst)",
    initials: "CR",
    color: "grass",
    subject: "Tomorrow's infield time",
    preview:
      "Can we move infield time to 4:15 tomorrow? I've got the JV game wrap-up running long and I want to make sure I'm there for the SS reps with Jordan and Sean…",
    time: "Yesterday",
    unread: true,
    kind: "coach",
  },
  {
    id: "t3",
    authorName: "Team · Parents",
    initials: "P",
    color: "sky",
    subject: "Reminder: Senior Night Friday 5 PM",
    preview:
      "You: Reminder, Senior Night vs Central Hawks Friday at 5 PM, home field. Ceremony at 4:30 — please be in your seats. Concessions volunteers needed…",
    time: "Yesterday",
    unread: false,
    kind: "broadcast",
  },
  {
    id: "t4",
    authorName: "Recruiter · TCU",
    initials: "TCU",
    color: "sky",
    subject: "Following up on Jordan Kim",
    preview:
      "Coach Martinez — saw Jordan's profile on Rostr after the PG showcase. Could we set up a phone call this week to discuss his junior season?…",
    time: "Sat",
    unread: false,
    kind: "coach",
  },
  {
    id: "t5",
    authorName: "Rostr System",
    initials: "R",
    color: "ink",
    subject: "Stats import complete · 15 players",
    preview:
      "Your GameChanger stats import finished. 15 players matched, 0 created, 0 errors. Batting + pitching lines are live on each player's profile…",
    time: "Fri",
    unread: false,
    kind: "system",
  },
];

const KIND_PILL: Record<DemoThread["kind"], { label: string; cls: string }> = {
  parent: { label: "Parent", cls: "bg-amber-soft text-amber" },
  broadcast: { label: "Team broadcast", cls: "bg-sky-soft text-sky" },
  coach: { label: "Coach", cls: "bg-grass-dim text-grass" },
  system: { label: "System", cls: "bg-paper-deep text-ink-3" },
};

export default function DemoMessagesPage() {
  const unreadCount = MOCK_THREADS.filter((t) => t.unread).length;
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: MOCK_TEAM.name }, { label: "Messages" }]}
        actions={[
          {
            kind: "primary",
            label: "Compose",
            icon: <Plus className="w-[15px] h-[15px]" />,
            href: "/signup",
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-md bg-red-soft text-red flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Inbox
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} unread · parents, recruiters, your staff`
                  : "All caught up"}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 relative">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Search messages, players, recruiters…"
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-hair rounded-md text-[13px] focus:outline-none focus:border-red"
              disabled
            />
          </div>

          {/* Thread list */}
          <div className="mt-5 bg-card border border-hair rounded-lg divide-y divide-hair-2 overflow-hidden">
            {MOCK_THREADS.map((t) => {
              const pill = KIND_PILL[t.kind];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "px-4 py-3.5 flex items-start gap-3 hover:bg-paper transition-colors cursor-pointer",
                    t.unread && "bg-paper-deep/40",
                  )}
                >
                  <Avatar
                    size="md"
                    color={t.color}
                    initials={t.initials}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "font-semibold text-[14px]",
                          t.unread ? "text-ink" : "text-ink-2",
                        )}
                      >
                        {t.authorName}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold uppercase tracking-[0.06em]",
                          pill.cls,
                        )}
                      >
                        {pill.label}
                      </span>
                      <span className="ml-auto text-[11px] text-ink-3 font-mono">
                        {t.time}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-[13.5px] mt-0.5 truncate",
                        t.unread ? "text-ink font-semibold" : "text-ink-2",
                      )}
                    >
                      {t.subject}
                    </div>
                    <div className="text-[12.5px] text-ink-3 mt-0.5 line-clamp-1">
                      {t.preview}
                    </div>
                  </div>
                  {t.unread && (
                    <div className="w-2 h-2 rounded-full bg-red mt-2 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-paper-deep border border-dashed border-hair rounded-lg p-5 text-center">
            <p className="text-[13px] text-ink-3 leading-relaxed">
              Inbox in Rostr unifies <b>parent messages</b>, <b>team
              broadcasts</b>, <b>recruiter outreach</b>, and{" "}
              <b>system notifications</b> — no app-switching during the
              season.
            </p>
            <Link
              href="/signup"
              className="inline-block mt-3 px-4 py-2 bg-red text-white rounded-sm text-[13px] font-semibold hover:bg-red/90"
            >
              Sign up to use it for real →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
