import {
  Bell,
  Plus,
  Clock,
  MapPin,
  Users,
  RefreshCw,
  Download,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { TopBar } from "@/components/organisms/top-bar";
import { Panel, PanelHead, PanelTab } from "@/components/molecules/panel";
import { StatTile } from "@/components/molecules/stat-tile";
import { FeedItem } from "@/components/molecules/feed-item";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import {
  MOCK_PLAYERS,
  MOCK_WEEK,
  MOCK_MESSAGES,
  MOCK_SPOTLIGHT,
  MOCK_AI_SUGGESTIONS,
} from "@/lib/mock-data";

/**
 * /app — Coach Hub.
 * Pixel match target: handoff/designs/02_Coach_Hub.html.
 * Spec: handoff/SCREENS.md §2.
 */
export default function HubPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Today" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, notification: true },
          { kind: "ghost", label: "Quick add", icon: <Plus className="w-[15px] h-[15px]" /> },
          { kind: "primary", label: "Start practice", href: "/app/practice" },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          {/* ── Hub header ────────────────────────────────── */}
          <div className="flex items-end justify-between mb-[22px] gap-6">
            <div>
              <span className="inline-flex items-center gap-2 px-[11px] py-1.5 bg-red-soft text-red rounded-full text-[11px] font-bold uppercase tracking-[0.04em]">
                <span className="w-1.5 h-1.5 rounded-full bg-red" />
                Tuesday · Apr 21
              </span>
              <h1 className="mt-2.5 font-display text-display-md">Afternoon, Coach.</h1>
              <p className="mt-1 text-ink-3 text-[14px]">
                Practice at 3:30. Game Friday vs Central Hawks. 2 parent messages need a reply.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" size="md">
                <RefreshCw className="w-[15px] h-[15px]" />
                Sync
              </Button>
              <Button variant="secondary" size="md">
                <Download className="w-[15px] h-[15px]" />
                Export week
              </Button>
            </div>
          </div>

          {/* ── Grid ────────────────────────────────────────── */}
          <div className="grid grid-cols-[1fr_340px] gap-[22px]">
            {/* MAIN COLUMN */}
            <div className="flex flex-col gap-[22px]">
              <TodayHeroCard />

              {/* Stat row */}
              <div className="grid grid-cols-4 gap-2.5">
                <StatTile label="Record" value="12–4" delta="+3 vs last season" deltaDirection="up" />
                <StatTile label="Team BA" value=".298" delta="+.014 last 5" deltaDirection="up" />
                <StatTile label="ERA" value="3.42" delta="+0.21 last 5" deltaDirection="down" />
                <StatTile label="Conf. rank" value="2nd" delta="of 8" />
              </div>

              {/* Availability */}
              <AvailabilityPanel />

              {/* Schedule + Plan row */}
              <div className="grid grid-cols-2 gap-[22px]">
                <ThisWeekPanel />
                <TodayPlanPanel />
              </div>

              {/* Activity feed */}
              <ActivityFeedPanel />
            </div>

            {/* SIDE COLUMN */}
            <div className="flex flex-col gap-[18px]">
              <AICoachCard />
              <QuickActionsPanel />
              <MessagesPanel />
              <PlayerSpotlightPanel />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main column sections ────────────────────────────────────────

function TodayHeroCard() {
  return (
    <div className="relative overflow-hidden rounded-lg p-6 bg-[linear-gradient(135deg,#0e1116_0%,#191d24_100%)] text-white">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-60 h-60 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200, 58, 58, 0.25), transparent 65%)",
        }}
      />
      <div className="relative">
        <div className="type-label !text-white/55">Next up · in 2h 14m</div>
        <div className="mt-1 font-display text-[26px] font-semibold tracking-tight leading-tight">
          Practice · Situational hitting & pitching
        </div>
        <div className="mt-3.5 flex flex-wrap gap-[18px] text-[12.5px] text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-[15px] h-[15px]" />
            3:30 – 5:30 PM
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-[15px] h-[15px]" />
            Field A
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-[15px] h-[15px]" />
            22 avail · 2 Q · 1 out
          </span>
        </div>
        <div className="mt-4.5 flex gap-2">
          <Link
            href="/app/practice"
            className="inline-flex items-center bg-red hover:bg-red/90 text-white rounded-sm px-3.5 h-[34px] text-[12.5px] font-semibold"
          >
            Open practice plan →
          </Link>
          <Link
            href="/app/practice"
            className="inline-flex items-center bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm px-3.5 h-[34px] text-[12.5px] font-semibold"
          >
            Field runner mode
          </Link>
          <Link
            href="/app/practice"
            className="inline-flex items-center bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm px-3.5 h-[34px] text-[12.5px] font-semibold"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}

function AvailabilityPanel() {
  return (
    <Panel>
      <PanelHead
        title="Today’s availability"
        actions={
          <>
            <PanelTab active>All</PanelTab>
            <PanelTab>Questionable (2)</PanelTab>
            <PanelTab>Out (1)</PanelTab>
            <button className="p-1 text-ink-3 hover:text-ink rounded-[5px]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </>
        }
      />
      <div>
        {MOCK_PLAYERS.map((p) => (
          <Link
            key={p.id}
            href={`/p/${p.handle}`}
            className="grid grid-cols-[28px_1fr_90px_110px_80px] gap-3 px-[18px] py-2.5 border-b border-hair-2 last:border-b-0 items-center hover:bg-paper transition-colors text-[13px]"
          >
            <div className="font-mono text-[11px] text-ink-3">#{p.jerseyNumber}</div>
            <div className="flex items-center gap-2 font-semibold">
              <Avatar size="sm" color={p.avatarColor} initials={p.initials} />
              {p.firstName} {p.lastName}
            </div>
            <div className="font-mono text-[11.5px] text-ink-3">
              {p.classYear} · {p.positions.join("/")}
            </div>
            <div>
              {p.availabilityStatus === "ok" && <Badge variant="keep">Available</Badge>}
              {p.availabilityStatus === "questionable" && (
                <Badge variant="bubble">{p.availabilityNote ?? "Q"}</Badge>
              )}
              {p.availabilityStatus === "out" && (
                <Badge variant="cut">{p.availabilityNote ?? "Out"}</Badge>
              )}
            </div>
            <div
              className={cn(
                "font-mono text-[11px] text-right",
                p.statEmphasis === "attention" ? "text-red" : "text-ink-3",
              )}
            >
              {p.stat}
            </div>
          </Link>
        ))}
      </div>
      <div className="px-[18px] py-2.5 border-t border-hair-2 text-[12px] text-ink-3 flex items-center">
        +15 more ·
        <Link href="/app/roster" className="ml-1.5 text-red font-semibold">
          View full roster →
        </Link>
      </div>
    </Panel>
  );
}

function ThisWeekPanel() {
  return (
    <Panel>
      <PanelHead
        title="This week"
        actions={
          <button className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1">
            View all →
          </button>
        }
      />
      <div>
        {MOCK_WEEK.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-[18px] py-3 border-b border-hair-2 last:border-b-0"
          >
            <div className="w-[42px] text-center shrink-0">
              <div className="font-display text-[20px] font-semibold leading-none">
                {item.date.day}
              </div>
              <div className="mt-0.5 text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.08em]">
                {item.date.month}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">
                {item.emphasis ? (
                  <>
                    {item.title.split("·")[0].trim()}{" "}
                    <span className="text-red">· {item.title.split("·")[1]?.trim() || ""}</span>
                  </>
                ) : (
                  item.title
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">{item.sub}</div>
            </div>
            <ScheduleTag kind={item.tag} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TodayPlanPanel() {
  return (
    <Panel>
      <PanelHead
        title="Today’s plan"
        actions={
          <button className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1">
            Open editor →
          </button>
        }
      />
      <div className="p-[18px] space-y-2.5">
        {[
          { time: "3:30", name: "Warm-up + throwing", focus: "Long-toss → short arc" },
          { time: "3:50", name: "Situational BP", focus: "Runners on 2nd, 0/1 outs" },
          { time: "4:30", name: "Infield / outfield", focus: "Cut-off depth + angles" },
          { time: "5:00", name: "Live at-bats", focus: "Bullpen vs hitter cycle" },
        ].map((b, i) => (
          <div
            key={i}
            className="flex gap-3 px-3 py-2.5 rounded-md bg-paper border-l-[3px] border-l-red hover:bg-paper-deep transition-colors"
          >
            <div className="shrink-0 w-11">
              <div className="font-mono text-[12px] font-bold">{b.time}</div>
              <div className="font-mono text-[10.5px] text-ink-3">20 min</div>
            </div>
            <div className="min-w-0">
              <div className="type-label">Hitting</div>
              <div className="mt-0.5 font-display text-[14px] font-semibold">{b.name}</div>
              <div className="mt-0.5 text-[11px] italic text-ink-3">{b.focus}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ActivityFeedPanel() {
  return (
    <Panel>
      <PanelHead
        title="Activity"
        actions={
          <>
            <PanelTab active>All</PanelTab>
            <PanelTab>Mine</PanelTab>
            <PanelTab>Players</PanelTab>
          </>
        }
      />
      <div>
        <FeedItem icon="EJ" iconColor="dirt" meta="9:42 AM · Parent message">
          <b>Ellen Johnson</b> sent a message re: Marcus&apos;s doctor note.
        </FeedItem>
        <FeedItem icon="JK" iconColor="sky" meta="8:18 AM · Profile">
          <b>Jordan Kim</b>&apos;s profile was viewed by <b>Arizona State</b> (recruiter).
        </FeedItem>
        <FeedItem icon="+3" iconColor="grass" meta="Yesterday · Roster">
          <b>3 players</b> claimed their profiles. Roster now 100% linked.
        </FeedItem>
        <FeedItem icon="CR" iconColor="amber" meta="Yesterday · Practice">
          <b>Coach Rivera</b> completed the Defense &amp; baserunning plan for Wednesday.
        </FeedItem>
        <FeedItem icon="W" iconColor="red" meta="Mon · Game result">
          Final: Lincoln HS <b>7</b> — Oakridge <b>4</b>. Johnson 3-for-4, 2 RBI.
        </FeedItem>
      </div>
    </Panel>
  );
}

// ── Side column sections ─────────────────────────────────────────

function AICoachCard() {
  return (
    <div className="relative overflow-hidden rounded-lg bg-ink text-white p-[18px]">
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200,58,58,.25), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.1em]">
          <span className="w-1.5 h-1.5 rounded-full bg-red" />
          AI Co-coach
        </div>
        <h4 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight leading-snug">
          What would you like to tackle first?
        </h4>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {MOCK_AI_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="flex items-center justify-between gap-2 px-2.5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-sm text-left text-[12px] transition-colors"
            >
              <span>{s.label}</span>
              <span className="font-mono text-[11px] text-red font-semibold shrink-0">
                {s.meta}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionsPanel() {
  return (
    <Panel>
      <PanelHead title="Quick actions" />
      <div className="grid grid-cols-2 gap-2 p-[14px]">
        {[
          { ic: "+", t: "Add player", s: "Manual entry" },
          { ic: "↑", t: "Import CSV", s: "GC / MaxPreps" },
          { ic: "◼", t: "New tryout", s: "Spring '26" },
          { ic: "✎", t: "Post update", s: "Team · Parents" },
        ].map((q, i) => (
          <button
            key={i}
            className="flex flex-col gap-1 p-[14px_12px] border border-hair rounded-md bg-card text-left hover:border-ink hover:-translate-y-px transition-all"
          >
            <span className="font-display text-[18px] font-bold text-red leading-none">{q.ic}</span>
            <span className="mt-1 text-[12.5px] font-semibold">{q.t}</span>
            <span className="text-[10.5px] text-ink-3">{q.s}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function MessagesPanel() {
  return (
    <Panel>
      <PanelHead
        title="Messages"
        actions={
          <button className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1">
            Inbox →
          </button>
        }
      />
      <div>
        {MOCK_MESSAGES.map((m) => (
          <Link
            key={m.id}
            href="/app/messages"
            className="flex gap-2.5 px-[18px] py-3 border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors cursor-pointer"
          >
            <Avatar size="md" color={m.avatarColor} initials={m.initials} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[13px] font-semibold truncate">{m.author}</span>
                <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-4">{m.time}</span>
              </div>
              <div className="text-[12px] text-ink-2 truncate">{m.preview}</div>
            </div>
            {m.unread && <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-red" />}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function PlayerSpotlightPanel() {
  return (
    <Panel>
      <PanelHead
        title="Player spotlight"
        actions={
          <button className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        }
      />
      <div className="p-[18px]">
        <div className="flex items-center gap-3 mb-3.5">
          <Avatar size="lg" color="ink" initials={MOCK_SPOTLIGHT.initials} />
          <div className="min-w-0">
            <div className="font-display text-[16px] font-semibold tracking-tight">
              {MOCK_SPOTLIGHT.name}
            </div>
            <div className="font-mono text-[11px] text-ink-3 mt-0.5">
              {MOCK_SPOTLIGHT.meta}
            </div>
          </div>
        </div>
        <div className="text-[12.5px] text-ink-2 px-3 py-2.5 bg-paper rounded-md border-l-[3px] border-l-red leading-relaxed">
          {MOCK_SPOTLIGHT.reason}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {MOCK_SPOTLIGHT.stats.map((s, i) => (
            <div key={i} className="text-center px-1 py-2 bg-paper rounded-sm">
              <div className="font-mono text-[15px] font-semibold">{s.value}</div>
              <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Bits ─────────────────────────────────────────────────────────

function ScheduleTag({ kind }: { kind: "PRAC" | "GAME" | "TRV" }) {
  const styles: Record<typeof kind, string> = {
    PRAC: "bg-paper-deep text-ink-2",
    GAME: "bg-red-soft text-red",
    TRV: "bg-grass-dim text-grass",
  };
  return (
    <span
      className={cn(
        "shrink-0 px-[7px] py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.04em]",
        styles[kind],
      )}
    >
      {kind}
    </span>
  );
}
