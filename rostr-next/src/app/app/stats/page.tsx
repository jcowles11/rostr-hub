import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, Trophy, Flame, Snowflake } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  fetchProgramBattingLeaders,
  fetchRosterBattingStats,
  formatAvg,
} from "@/lib/services/batting-stats";
import { fetchProgramPitchingLeaders } from "@/lib/services/pitching-stats";
import { formatIP, formatERA, formatWHIP } from "@/lib/format";

/**
 * /app/stats — team-level performance dashboard.
 *
 * Distinct from /app/analytics (which is platform usage). This is on-field:
 *   - Top batters by OPS
 *   - Top pitchers by ERA
 *   - Hot/cold list (placeholder until per-game trends land)
 *   - Team aggregate row at the bottom
 *
 * Pulls live + imported stats via the same service layer the profile uses.
 */
export default async function StatsPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const [batters, pitchers, rosterBatting] = await Promise.all([
    fetchProgramBattingLeaders(coach.program_id, 15),
    fetchProgramPitchingLeaders(coach.program_id, 10),
    fetchRosterBattingStats(coach.program_id),
  ]);

  // Build a hot/cold split from the available roster batting map. v1 just
  // uses overall season OPS as a proxy until per-game trends are wired.
  const ranked = Object.entries(rosterBatting)
    .filter(([, s]) => s.games >= 3)
    .sort((a, b) => b[1].ops - a[1].ops);
  const hot = ranked.slice(0, 3);
  const cold = ranked.slice(-3).reverse();

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: coach.program_name }, { label: "Stats" }]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-md bg-grass-dim text-grass flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="type-label !text-red">On-field performance</div>
              <h1 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Team stats
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                Season leaders, hot streaks, and slumps — built from every at-bat in Rostr.
              </p>
            </div>
          </div>

          {batters.length === 0 && pitchers.length === 0 ? (
            <div className="bg-card border border-dashed border-hair rounded-lg p-10 text-center">
              <Trophy className="w-10 h-10 mx-auto text-ink-3 mb-3" />
              <h2 className="font-display text-[20px] font-semibold tracking-tight">
                No stats yet
              </h2>
              <p className="text-[13px] text-ink-3 mt-2 max-w-[420px] mx-auto leading-relaxed">
                Once you import stats from GameChanger or score a game live in
                Rostr, leaderboards and trends populate here automatically.
              </p>
              <div className="mt-5 flex justify-center gap-2 flex-wrap">
                <Link
                  href="/app/roster"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-semibold"
                >
                  Import stats from GameChanger →
                </Link>
                <Link
                  href="/app/games"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-paper hover:bg-paper-deep border border-hair text-ink rounded-sm text-[13px] font-semibold"
                >
                  Score a game live →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Hot streaks */}
              {hot.length > 0 && (
                <div className="bg-card border border-hair rounded-lg overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red" />
                    <h2 className="font-display text-[15px] font-semibold tracking-tight">
                      Hot
                    </h2>
                  </div>
                  <div className="divide-y divide-hair-2">
                    {hot.map(([playerId, s]) => (
                      <div key={playerId} className="px-5 py-3 flex items-center gap-3">
                        <div className="flex-1 text-[13px] font-semibold truncate">
                          {playerId.slice(0, 8)}…
                        </div>
                        <div className="font-mono text-[14px] font-bold text-red">
                          {formatAvg(s.ops)}
                        </div>
                        <div className="font-mono text-[10.5px] text-ink-3 w-16 text-right">
                          {s.games} G
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cold streaks */}
              {cold.length > 0 && (
                <div className="bg-card border border-hair rounded-lg overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                    <Snowflake className="w-4 h-4 text-sky" />
                    <h2 className="font-display text-[15px] font-semibold tracking-tight">
                      Slumping
                    </h2>
                  </div>
                  <div className="divide-y divide-hair-2">
                    {cold.map(([playerId, s]) => (
                      <div key={playerId} className="px-5 py-3 flex items-center gap-3">
                        <div className="flex-1 text-[13px] font-semibold truncate">
                          {playerId.slice(0, 8)}…
                        </div>
                        <div className="font-mono text-[14px] font-bold text-ink-3">
                          {formatAvg(s.ops)}
                        </div>
                        <div className="font-mono text-[10.5px] text-ink-3 w-16 text-right">
                          {s.games} G
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top batters */}
              <div className="bg-card border border-hair rounded-lg overflow-hidden lg:col-span-2">
                <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-red" />
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Batting leaders
                  </h2>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                    Min 5 PA
                  </span>
                </div>
                {batters.length === 0 ? (
                  <div className="p-8 text-[13px] text-ink-3 text-center">
                    No qualifying batters yet.
                  </div>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead className="bg-paper">
                      <tr>
                        {["#", "Player", "G", "AVG", "OBP", "SLG", "OPS", "HR", "RBI"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hair-2">
                      {batters.map((b, i) => (
                        <tr key={b.playerId} className="hover:bg-paper">
                          <td className="px-3 py-2 font-mono text-ink-3">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold">
                            {b.profileSlug ? (
                              <Link
                                href={`/p/${b.profileSlug}`}
                                target="_blank"
                                className="hover:underline"
                              >
                                {b.firstName} {b.lastName}
                              </Link>
                            ) : (
                              <>
                                {b.firstName} {b.lastName}
                              </>
                            )}
                            {b.playerNumber ? (
                              <span className="font-mono text-ink-3 ml-1">
                                #{b.playerNumber}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 font-mono">{b.games}</td>
                          <td className="px-3 py-2 font-mono">{formatAvg(b.ba)}</td>
                          <td className="px-3 py-2 font-mono">{formatAvg(b.obp)}</td>
                          <td className="px-3 py-2 font-mono">{formatAvg(b.slg)}</td>
                          <td className="px-3 py-2 font-mono font-bold">
                            {formatAvg(b.ops)}
                          </td>
                          <td className="px-3 py-2 font-mono">{b.hr}</td>
                          <td className="px-3 py-2 font-mono">{b.rbi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top pitchers */}
              <div className="bg-card border border-hair rounded-lg overflow-hidden lg:col-span-2">
                <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-sky" />
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Pitching leaders
                  </h2>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                    Min 3 IP
                  </span>
                </div>
                {pitchers.length === 0 ? (
                  <div className="p-8 text-[13px] text-ink-3 text-center">
                    No qualifying pitchers yet.
                  </div>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead className="bg-paper">
                      <tr>
                        {["#", "Pitcher", "G", "IP", "ERA", "WHIP", "K", "BB", "K/9"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hair-2">
                      {pitchers.map((p, i) => (
                        <tr key={p.playerId} className="hover:bg-paper">
                          <td className="px-3 py-2 font-mono text-ink-3">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold">
                            {p.profileSlug ? (
                              <Link
                                href={`/p/${p.profileSlug}`}
                                target="_blank"
                                className="hover:underline"
                              >
                                {p.firstName} {p.lastName}
                              </Link>
                            ) : (
                              <>
                                {p.firstName} {p.lastName}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">{p.games}</td>
                          <td className="px-3 py-2 font-mono">{formatIP(p.ip)}</td>
                          <td className="px-3 py-2 font-mono font-bold">{formatERA(p.era)}</td>
                          <td className="px-3 py-2 font-mono">{formatWHIP(p.whip)}</td>
                          <td className="px-3 py-2 font-mono">{p.k}</td>
                          <td className="px-3 py-2 font-mono">{p.bb}</td>
                          <td className="px-3 py-2 font-mono">{p.k9.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
