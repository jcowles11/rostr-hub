import Link from "next/link";
import { Trophy, TrendingUp, Activity } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import {
  MOCK_PLAYERS,
  MOCK_BATTING_LEADERS,
  MOCK_PITCHING_LEADERS,
  MOCK_TEAM,
  type MockPlayer,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /demo/stats — team leaderboards.
 *
 * Mirrors /app/stats. The demo data flows from MOCK_BATTING_LEADERS
 * and MOCK_PITCHING_LEADERS (computed once at module load from each
 * player's anchored BA/ERA in MOCK_PLAYERS).
 *
 * Hot/cold splits are static for the tour — real /app/stats computes
 * them from live game_events.
 */

export const metadata = {
  title: "Stats · Demo · Rostr",
  robots: { index: false, follow: false },
};

const formatAvg = (n: number) =>
  n.toFixed(3).replace(/^0/, "");

const formatERA = (n: number) => n.toFixed(2);

export default function DemoStatsPage() {
  const playerById = new Map(MOCK_PLAYERS.map((p) => [p.id, p]));

  // Top-line program totals (sum of all batters' AB / H)
  const teamAB = MOCK_BATTING_LEADERS.reduce((s, l) => s + l.ab, 0);
  const teamH = MOCK_BATTING_LEADERS.reduce((s, l) => s + l.h, 0);
  const teamHR = MOCK_BATTING_LEADERS.reduce((s, l) => s + l.hr, 0);
  const teamBA = teamAB > 0 ? teamH / teamAB : 0;

  const teamIP = MOCK_PITCHING_LEADERS.reduce((s, l) => s + l.ip, 0);
  const teamER = MOCK_PITCHING_LEADERS.reduce((s, l) => s + l.er, 0);
  const teamK = MOCK_PITCHING_LEADERS.reduce((s, l) => s + l.k, 0);
  const teamERA = teamIP > 0 ? (teamER * 9) / teamIP : 0;

  return (
    <>
      <TopBar breadcrumbs={[{ label: MOCK_TEAM.name }, { label: "Stats" }]} />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div>
            <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Team stats
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Live from every at-bat scored in Rostr. Sorted by OPS and
              ERA — switch view to slice by position, class year, or
              split.
            </p>
          </div>

          {/* Top tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
            <SummaryTile label="Team BA" value={formatAvg(teamBA)} sub={`${teamH} H · ${teamAB} AB`} />
            <SummaryTile label="Team HR" value={String(teamHR)} sub="22 games" />
            <SummaryTile label="Team ERA" value={formatERA(teamERA)} sub={`${teamK} K`} />
            <SummaryTile label="Record" value="12–4" sub="2nd in district" />
          </div>

          {/* Batting leaders */}
          <Section
            icon={<Trophy className="w-3.5 h-3.5" />}
            title="Batting leaders"
            subtitle="Sorted by OPS · min 10 games"
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 border-b border-hair-2">
                  <th className="text-left px-4 py-3 w-8">#</th>
                  <th className="text-left px-3 py-3">Player</th>
                  <th className="text-right px-3 py-3 hidden sm:table-cell">G</th>
                  <th className="text-right px-3 py-3">AVG</th>
                  <th className="text-right px-3 py-3">OBP</th>
                  <th className="text-right px-3 py-3">SLG</th>
                  <th className="text-right px-3 py-3">OPS</th>
                  <th className="text-right px-3 py-3 hidden md:table-cell">HR</th>
                  <th className="text-right px-3 py-3 hidden md:table-cell">RBI</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_BATTING_LEADERS.map((line, i) => {
                  const player = playerById.get(line.playerId);
                  if (!player) return null;
                  return (
                    <LeaderRow
                      key={line.playerId}
                      rank={i + 1}
                      player={player}
                      cells={[
                        { v: String(line.games), hideOnMobile: true },
                        { v: formatAvg(line.ba), highlight: line.ba >= 0.3 },
                        { v: formatAvg(line.obp) },
                        { v: formatAvg(line.slg) },
                        { v: formatAvg(line.ops), highlight: line.ops >= 0.85 },
                        { v: String(line.hr), hideOnMd: true },
                        { v: String(line.rbi), hideOnMd: true },
                      ]}
                    />
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* Pitching leaders */}
          <Section
            icon={<Activity className="w-3.5 h-3.5" />}
            title="Pitching leaders"
            subtitle="Sorted by ERA · min 1 appearance"
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 border-b border-hair-2">
                  <th className="text-left px-4 py-3 w-8">#</th>
                  <th className="text-left px-3 py-3">Player</th>
                  <th className="text-right px-3 py-3 hidden sm:table-cell">G</th>
                  <th className="text-right px-3 py-3">IP</th>
                  <th className="text-right px-3 py-3">ERA</th>
                  <th className="text-right px-3 py-3">WHIP</th>
                  <th className="text-right px-3 py-3 hidden md:table-cell">K/9</th>
                  <th className="text-right px-3 py-3 hidden md:table-cell">K</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PITCHING_LEADERS.map((line, i) => {
                  const player = playerById.get(line.playerId);
                  if (!player) return null;
                  return (
                    <LeaderRow
                      key={line.playerId}
                      rank={i + 1}
                      player={player}
                      cells={[
                        { v: String(line.games), hideOnMobile: true },
                        { v: line.ip.toFixed(1) },
                        { v: formatERA(line.era), highlight: line.era < 3.0 },
                        { v: line.whip.toFixed(2), highlight: line.whip < 1.2 },
                        { v: line.k9.toFixed(1), hideOnMd: true },
                        { v: String(line.k), hideOnMd: true },
                      ]}
                    />
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* Hot / Cold splits — static */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-7">
            <SplitCard
              tone="grass"
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              title="Hot last 5 games"
              rows={[
                { name: "Marcus Johnson", line: ".476 / .545 · 2 HR" },
                { name: "Jordan Kim", line: ".385 / .429 · 4 RBI" },
                { name: "Jaylen Carter", line: ".364 / .417 · 3 2B" },
              ]}
            />
            <SplitCard
              tone="sky"
              icon={<TrendingUp className="w-3.5 h-3.5 rotate-180" />}
              title="Cold last 5 games"
              rows={[
                { name: "Mateo Vasquez", line: ".118 / .211 · 5 K" },
                { name: "Ethan Murphy", line: ".143 / .200 · 4 K" },
                { name: "Tre Mbeki", line: ".167 / .250 · 0 RBI" },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg p-4">
      <div className="type-label">{label}</div>
      <div className="font-mono text-[28px] font-semibold tracking-[-0.02em] mt-1.5 leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-ink-3 mt-1.5 font-mono">{sub}</div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7 bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        <span className="text-ink-3">{icon}</span>
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[11.5px] text-ink-3 ml-2">{subtitle}</span>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function LeaderRow({
  rank,
  player,
  cells,
}: {
  rank: number;
  player: MockPlayer;
  cells: Array<{
    v: string;
    highlight?: boolean;
    hideOnMobile?: boolean;
    hideOnMd?: boolean;
  }>;
}) {
  return (
    <tr className="border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors">
      <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-ink-3">
        {rank}
      </td>
      <td className="px-3 py-2.5">
        <Link
          href={`/p/${player.handle}`}
          className="flex items-center gap-2 group"
        >
          <span className="font-mono text-[10px] text-ink-3 w-8 shrink-0">
            #{player.jerseyNumber}
          </span>
          <span className="font-semibold group-hover:text-red transition-colors">
            {player.firstName} {player.lastName}
          </span>
          <span className="text-[10px] text-ink-3 ml-1">
            {player.positions[0]}
          </span>
        </Link>
      </td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={cn(
            "text-right px-3 py-2.5 font-mono",
            c.highlight && "text-red font-semibold",
            c.hideOnMobile && "hidden sm:table-cell",
            c.hideOnMd && "hidden md:table-cell",
          )}
        >
          {c.v}
        </td>
      ))}
    </tr>
  );
}

function SplitCard({
  tone,
  icon,
  title,
  rows,
}: {
  tone: "grass" | "sky";
  icon: React.ReactNode;
  title: string;
  rows: Array<{ name: string; line: string }>;
}) {
  const toneClass =
    tone === "grass" ? "bg-grass-dim text-grass" : "bg-sky-soft text-sky";
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
        <span className={cn("w-6 h-6 rounded-md flex items-center justify-center", toneClass)}>
          {icon}
        </span>
        <h3 className="font-display text-[14.5px] font-semibold tracking-tight">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-hair-2">
        {rows.map((r) => (
          <div
            key={r.name}
            className="px-5 py-2.5 flex items-center justify-between text-[13px]"
          >
            <span className="font-semibold">{r.name}</span>
            <span className="font-mono text-[12px] text-ink-3">{r.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
