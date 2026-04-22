"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  ClipboardList,
  Printer,
  Share2,
  Bell,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { LevelPill } from "@/components/atoms/level-pill";
import { cn } from "@/lib/utils";
import { MOCK_PLAYERS } from "@/lib/mock-data";

/**
 * /app/games/[id] — Game day stub.
 * Tabbed: Roster / Lineup / Live / Recap. Live + Recap stubs for now.
 */
const TABS = ["Roster", "Lineup", "Live", "Recap"] as const;
type Tab = (typeof TABS)[number];

export default function GamePage() {
  const [tab, setTab] = useState<Tab>("Roster");
  const varsityPlayers = MOCK_PLAYERS.filter((p) => p.level === "V");

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Lincoln HS" },
          { label: "Games" },
          { label: "vs Central Hawks" },
        ]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" /> },
          { kind: "ghost", label: "Print card", icon: <Printer className="w-[15px] h-[15px]" /> },
          { kind: "primary", label: "Open live", icon: <ClipboardList className="w-[15px] h-[15px]" /> },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-6 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <Link href="/app/games" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to games
          </Link>

          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="type-label !text-red mb-1.5">Friday · Apr 24 · Conference</div>
              <h1 className="font-display text-[44px] font-semibold tracking-[-0.03em] leading-[1.05]">
                vs Central Hawks
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-[13.5px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> 5:00 PM · <b className="font-semibold text-ink">1h 14m away</b>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Lincoln HS · Main field (home)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> {varsityPlayers.length} Varsity
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="md">
                <Share2 className="w-[15px] h-[15px]" /> Share
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-hair mb-6">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-[18px] py-3 text-[13.5px] font-semibold border-b-2 -mb-px transition-colors",
                  t === tab ? "text-ink border-red" : "text-ink-3 border-transparent hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Roster" && <RosterTab />}
          {tab === "Lineup" && <LineupTab />}
          {tab === "Live" && (
            <div className="p-10 bg-card border border-hair rounded-lg text-center">
              <div className="font-display text-[22px] font-semibold tracking-tight mb-2">
                Dugout console comes online at first pitch.
              </div>
              <div className="text-[13.5px] text-ink-3 max-w-[420px] mx-auto">
                Plate appearances, pitching log, and sub tracking. Syncs back to every player&apos;s
                profile automatically.
              </div>
            </div>
          )}
          {tab === "Recap" && (
            <div className="p-10 bg-card border border-hair rounded-lg text-center">
              <div className="font-display text-[22px] font-semibold tracking-tight mb-2">
                Recap available after the game.
              </div>
              <div className="text-[13.5px] text-ink-3 max-w-[420px] mx-auto">
                Box score, star performers, and auto-generated highlight clips.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RosterTab() {
  const players = MOCK_PLAYERS.filter((p) => p.level === "V");
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Game roster</h3>
        <span className="font-mono text-[10.5px] text-ink-3 font-semibold">
          {players.length} ACTIVE · 2 Q · 1 OUT
        </span>
        <Button variant="secondary" size="sm" className="ml-auto">
          Edit roster
        </Button>
      </div>
      <table className="w-full text-[13px]">
        <thead className="bg-paper border-b border-hair">
          <tr>
            <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[48px]">#</th>
            <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Player</th>
            <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px]">Pos</th>
            <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px]">Level</th>
            <th className="text-right px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[80px]">BA</th>
            <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[130px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-hair-2 last:border-b-0 hover:bg-paper cursor-pointer">
              <td className="px-3.5 py-2.5 font-mono">{p.jerseyNumber}</td>
              <td className="px-3.5 py-2.5">
                <Link href={`/p/${p.handle}`} className="flex items-center gap-2.5 hover:underline">
                  <Avatar size="md" color={p.avatarColor} initials={p.initials} />
                  <span className="font-semibold">{p.firstName} {p.lastName}</span>
                </Link>
              </td>
              <td className="px-3.5 py-2.5 font-mono">{p.positions.join("/")}</td>
              <td className="px-3.5 py-2.5">
                <LevelPill level={p.level} />
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono">
                {p.ba ?? <span className="text-ink-4">—</span>}
              </td>
              <td className="px-3.5 py-2.5">
                {p.availabilityStatus === "ok" && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-grass">
                    <span className="w-[7px] h-[7px] rounded-full bg-grass" /> Available
                  </span>
                )}
                {p.availabilityStatus === "questionable" && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-amber">
                    <span className="w-[7px] h-[7px] rounded-full bg-amber" />{" "}
                    {p.availabilityNote ?? "Q"}
                  </span>
                )}
                {p.availabilityStatus === "out" && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-red">
                    <span className="w-[7px] h-[7px] rounded-full bg-red" />{" "}
                    {p.availabilityNote ?? "Out"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineupTab() {
  const starters = MOCK_PLAYERS.filter((p) => p.level === "V" && p.availabilityStatus !== "out").slice(0, 9);
  const positions = ["LF", "SS", "CF", "1B", "RF", "3B", "2B", "C", "P"];
  return (
    <div className="grid grid-cols-[1fr_320px] gap-5">
      <div className="bg-card border border-hair rounded-lg overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">Starting lineup</h3>
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
            ● Saved 4m ago
          </span>
        </div>
        <div>
          {starters.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3 border-b border-hair-2 last:border-b-0">
              <div className="font-mono text-[18px] font-bold w-8">{i + 1}</div>
              <Avatar size="md" color={p.avatarColor} initials={p.initials} />
              <div className="flex-1">
                <div className="font-semibold text-[13.5px]">{p.firstName} {p.lastName}</div>
                <div className="font-mono text-[10.5px] text-ink-3">
                  #{p.jerseyNumber} · {p.classYearShort} · {p.ba ?? "—"} BA
                </div>
              </div>
              <div className="w-14 text-center">
                <span className="font-mono text-[14px] font-bold">{positions[i]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="bg-card border border-hair rounded-lg p-5">
          <div className="type-label">Bench</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MOCK_PLAYERS.filter((p) => p.level === "V").slice(9).map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-paper rounded-xs text-[11.5px] font-semibold">
                <Avatar size="xs" color={p.avatarColor} initials={p.initials} />
                #{p.jerseyNumber}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-ink text-white rounded-lg p-5">
          <div className="type-label !text-red">AI · suggested</div>
          <div className="font-display text-[14px] font-semibold tracking-tight mt-1.5 leading-snug">
            Johnson &amp; Peña are hitting .390+ over last 5 — keep them 1-2.
          </div>
          <div className="text-[11.5px] text-white/70 mt-2">
            Based on last-5-game BA, vs RHP history, and Central Hawks&apos; pitching tendencies.
          </div>
        </div>
      </div>
    </div>
  );
}
