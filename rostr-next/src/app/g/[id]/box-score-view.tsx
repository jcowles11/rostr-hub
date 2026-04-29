"use client";

import Link from "next/link";
import { Trophy, Star, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoxScore, HitterLine, PitcherLine } from "@/lib/services/box-score";
import {
  formatERA,
  formatRate,
  gameHeadline,
  getKeyPerformers,
  hitterLineSummary,
  pitcherLineSummary,
} from "@/lib/services/box-score";
import type { PlayerLink } from "./fan-game-view";

/**
 * BoxScoreView — renders hitter + pitcher tables for a single game.
 *
 * Mobile-first: tables are horizontally scrollable inside their own
 * container, headers stay sticky vertically, and player names link to
 * profiles when available.
 *
 * Pure presentation — all derivation lives in `box-score.ts`.
 */
export function BoxScoreView({
  box,
  playerLinks,
  programName,
  ourScore,
  theirScore,
  isFinal,
}: {
  box: BoxScore;
  playerLinks: Record<string, PlayerLink>;
  programName: string;
  ourScore: number;
  theirScore: number;
  /** When false, panel renders "in-progress" subtitle. */
  isFinal: boolean;
}) {
  const performers = getKeyPerformers(box);
  const nameFor = (id: string) => {
    const link = playerLinks[id];
    if (!link) return "Unknown";
    return link.name ?? "Unknown";
  };
  const headline = gameHeadline(
    ourScore,
    theirScore,
    programName,
    performers,
    nameFor,
  );

  return (
    <div className="space-y-4">
      <GameSummaryPanel
        headline={headline}
        ourScore={ourScore}
        theirScore={theirScore}
        performers={performers}
        playerLinks={playerLinks}
        isFinal={isFinal}
      />

      {/* Hitters */}
      <Section title="Hitters" count={box.hitters.length}>
        {box.hitters.length === 0 ? (
          <EmptyRow text="No at-bats logged yet." />
        ) : (
          <div className="overflow-x-auto -mx-3 px-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-ink-3 font-bold uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left py-1.5 pr-2">Player</th>
                  <Th>AB</Th>
                  <Th>R</Th>
                  <Th>H</Th>
                  <Th>RBI</Th>
                  <Th>BB</Th>
                  <Th>K</Th>
                  <Th>SB</Th>
                  <Th>AVG</Th>
                  <Th>OPS</Th>
                </tr>
              </thead>
              <tbody>
                {box.hitters.map((h) => (
                  <HitterRow
                    key={h.playerId}
                    h={h}
                    link={playerLinks[h.playerId] ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Pitchers */}
      <Section title="Pitchers" count={box.pitchers.length}>
        {box.pitchers.length === 0 ? (
          <EmptyRow text="No pitcher tracked yet — coach can pick a pitcher in the scoring view." />
        ) : (
          <div className="overflow-x-auto -mx-3 px-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-ink-3 font-bold uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left py-1.5 pr-2">Pitcher</th>
                  <Th>IP</Th>
                  <Th>H</Th>
                  <Th>R</Th>
                  <Th>ER</Th>
                  <Th>BB</Th>
                  <Th>K</Th>
                  <Th>P</Th>
                  <Th>ERA</Th>
                </tr>
              </thead>
              <tbody>
                {box.pitchers.map((p) => (
                  <PitcherRow
                    key={p.pitcherId}
                    p={p}
                    link={playerLinks[p.pitcherId] ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Game summary panel ──────────────────────────────────────

/**
 * GameSummaryPanel — hero strip at the top of the box-score view.
 *
 * Shows the templated headline + score + 1-3 key performer chips. Used
 * both on the fan view (when game is final or in progress) and on the
 * coach Recap tab (future integration).
 */
function GameSummaryPanel({
  headline,
  ourScore,
  theirScore,
  performers,
  playerLinks,
  isFinal,
}: {
  headline: string;
  ourScore: number;
  theirScore: number;
  performers: ReturnType<typeof getKeyPerformers>;
  playerLinks: Record<string, PlayerLink>;
  isFinal: boolean;
}) {
  return (
    <div className="bg-ink text-white rounded-md p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red shrink-0">
          {isFinal ? (
            <Trophy className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-red">
            {isFinal ? "Game summary" : "Through latest play"}
          </div>
          <div className="font-display text-[14px] sm:text-[15px] font-semibold tracking-tight mt-0.5 leading-snug break-words">
            {headline}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[24px] font-bold tracking-tight leading-none">
            {ourScore}
            <span className="text-white/40 mx-1">–</span>
            {theirScore}
          </div>
        </div>
      </div>

      {performers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
          {performers.map((p) => {
            const link = playerLinks[p.playerId];
            const name = link?.name ?? "Unknown";
            const inner = (
              <span className="inline-flex items-center gap-1.5">
                <Star className="w-3 h-3 text-red" />
                <span className="font-semibold text-[12.5px]">
                  {link?.jersey != null && (
                    <span className="font-mono text-white/60 mr-1">
                      #{link.jersey}
                    </span>
                  )}
                  {name}
                </span>
                <span className="text-[11.5px] text-white/70">— {p.line}</span>
              </span>
            );
            return (
              <div key={p.playerId} className="flex items-center">
                {link?.handle ? (
                  <Link
                    href={`/p/${link.handle}`}
                    className="hover:underline inline-flex items-center gap-1"
                    prefetch={false}
                  >
                    {inner}
                    <ArrowRight className="w-3 h-3 text-white/40" />
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-hair rounded-md">
      <div className="px-3 py-2 border-b border-hair-2 flex items-center gap-2">
        <h3 className="font-display text-[13px] font-semibold tracking-tight">
          {title}
        </h3>
        <span className="font-mono text-[10.5px] text-ink-3 font-semibold">
          {count}
        </span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-[12px] text-ink-3 text-center py-3">{text}</div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-right px-1.5 py-1.5 font-mono w-[36px]">{children}</th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={cn(
        "text-right px-1.5 py-1.5",
        mono && "font-mono",
      )}
    >
      {children}
    </td>
  );
}

// ── Rows ────────────────────────────────────────────────────

function HitterRow({ h, link }: { h: HitterLine; link: PlayerLink | null }) {
  const name = link?.name ?? "Unknown";
  const cell = (
    <span className="inline-flex items-center gap-1.5">
      {link?.jersey != null && (
        <span className="font-mono text-[10.5px] text-ink-3 font-bold">
          #{link.jersey}
        </span>
      )}
      <span className="font-semibold">{name}</span>
    </span>
  );
  return (
    <tr
      className="border-t border-hair-2 hover:bg-paper transition-colors"
      title={hitterLineSummary(h)}
    >
      <td className="text-left py-1.5 pr-2">
        {link?.handle ? (
          <Link
            href={`/p/${link.handle}`}
            className="hover:underline"
            prefetch={false}
          >
            {cell}
          </Link>
        ) : (
          cell
        )}
      </td>
      <Td mono>{h.ab}</Td>
      <Td mono>{h.r}</Td>
      <Td mono>{h.h}</Td>
      <Td mono>{h.rbi}</Td>
      <Td mono>{h.bb}</Td>
      <Td mono>{h.k}</Td>
      <Td mono>{h.sb}</Td>
      <Td mono>{h.ab > 0 ? formatRate(h.avg) : "—"}</Td>
      <Td mono>{h.ab > 0 ? formatRate(h.ops) : "—"}</Td>
    </tr>
  );
}

function PitcherRow({ p, link }: { p: PitcherLine; link: PlayerLink | null }) {
  const name = link?.name ?? "Unknown";
  const cell = (
    <span className="inline-flex items-center gap-1.5">
      {link?.jersey != null && (
        <span className="font-mono text-[10.5px] text-ink-3 font-bold">
          #{link.jersey}
        </span>
      )}
      <span className="font-semibold">{name}</span>
    </span>
  );
  return (
    <tr
      className="border-t border-hair-2 hover:bg-paper transition-colors"
      title={pitcherLineSummary(p)}
    >
      <td className="text-left py-1.5 pr-2">
        {link?.handle ? (
          <Link
            href={`/p/${link.handle}`}
            className="hover:underline"
            prefetch={false}
          >
            {cell}
          </Link>
        ) : (
          cell
        )}
      </td>
      <Td mono>{p.ip}</Td>
      <Td mono>{p.h}</Td>
      <Td mono>{p.r}</Td>
      <Td mono>{p.er}</Td>
      <Td mono>{p.bb}</Td>
      <Td mono>{p.k}</Td>
      <Td mono>{p.pitches}</Td>
      <Td mono>{formatERA(p.era, p.outs)}</Td>
    </tr>
  );
}
