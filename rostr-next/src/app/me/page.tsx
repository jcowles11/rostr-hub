import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  AlertCircle,
  Swords,
  Dumbbell,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { Avatar, avatarColorFromSeed } from "@/components/atoms/avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPlayerMeasurables } from "@/lib/services/tryouts";
import { fetchInbox } from "@/lib/services/messaging";
import {
  fetchPlayerSeasonBatting,
  fetchPlayerCareerBatting,
  formatAvg,
} from "@/lib/services/batting-stats";
import {
  fetchPlayerSeasonPitching,
  fetchPlayerCareerPitching,
} from "@/lib/services/pitching-stats";
import { formatIP, formatERA, formatWHIP } from "@/lib/format";
import { MeHeaderActions, QuickAction } from "./interactive";
import { cn } from "@/lib/utils";

/**
 * /me — the authenticated player's home.
 *
 * Flow:
 *   - Require auth (middleware handles)
 *   - Find the player row where claimed_by_user_id = user.id
 *   - If no claimed player AND user is a coach → redirect /app
 *   - If no claimed player AND user is not a coach → show "claim your
 *     profile" card with instructions
 *   - Otherwise render a real player-facing dashboard
 */
export default async function MePage({
  searchParams,
}: {
  searchParams: { claimed?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me");

  const { data: player } = await supabase
    .from("players")
    .select("id, first_name, last_name, grade, positions, player_number, profile_slug, program_id, availability_status, availability_note")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();

  // Coach fallback — if no player but the user has a coaches row, send
  // them to /app (their actual workspace).
  if (!player) {
    const { data: coaches } = await supabase
      .from("coaches")
      .select("program_id")
      .eq("user_id", user.id)
      .limit(1);
    if (coaches && coaches.length > 0) redirect("/app");
    return <NoProfileFound />;
  }

  // Program context
  const { data: program } = await supabase
    .from("programs")
    .select("name, sport, levels")
    .eq("id", player.program_id)
    .maybeSingle();

  // Team assignment (for "Varsity" label)
  const { data: assign } = await supabase
    .from("roster_assignments")
    .select("assignment")
    .eq("player_id", player.id)
    .maybeSingle();
  const teamLevel = assign?.assignment;

  // Upcoming games for THEIR team
  const today = new Date().toISOString().slice(0, 10);
  const { data: games } = await supabase
    .from("games")
    .select(
      "id, name, opponent, game_date, game_time, location, home_away, team_level, report_time, release_time, uniform, equipment_notes, lineup_preview, prep_notes",
    )
    .eq("program_id", player.program_id)
    .gte("game_date", today)
    .order("game_date", { ascending: true })
    .limit(10);
  const myGames = (games ?? []).filter((g) => {
    if (!teamLevel) return true;
    const gLevel = (g.team_level ?? "").toLowerCase();
    return gLevel === teamLevel.toLowerCase();
  });

  // Upcoming practices (any level for now)
  const { data: practices } = await supabase
    .from("practice_plans")
    .select("id, practice_date, team_level, title")
    .eq("program_id", player.program_id)
    .gte("practice_date", today)
    .order("practice_date", { ascending: true })
    .limit(5);

  // Measurables + real batting + pitching stats
  const [measurables, seasonLine, careerLine, pitchingSeason, pitchingCareer] = await Promise.all([
    fetchPlayerMeasurables(player.id),
    fetchPlayerSeasonBatting(player.id),
    fetchPlayerCareerBatting(player.id),
    fetchPlayerSeasonPitching(player.id),
    fetchPlayerCareerPitching(player.id),
  ]);

  // Inbox: pending recruiter requests + unread messages
  const threads = await fetchInbox();
  const pendingRequests = threads.filter(
    (t) => t.kind === "recruiter_outreach" && t.outreachStatus === "pending",
  );
  const unreadMessages = threads.reduce((n, t) => n + t.unreadCount, 0);

  const initials = (player.first_name?.[0] ?? "") + (player.last_name?.[0] ?? "");
  const avatarColor = avatarColorFromSeed(player.id);
  const levelLabel = teamLevel
    ? (program?.levels ?? []).find((l: string) => l.toLowerCase() === teamLevel) ?? teamLevel
    : "Unassigned";

  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-layout-marketing mx-auto px-4 sm:px-6 lg:px-7 py-6 sm:py-8">
        {searchParams.claimed && (
          <div className="mb-6 flex items-start gap-2 p-3 rounded-sm bg-grass-dim text-grass text-[12.5px]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <b>Profile claimed.</b> You&apos;re now linked to your coach-managed
              profile. Scouts seeing your career data at rostr.app/{player.profile_slug}.
            </div>
          </div>
        )}

        {/* Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <Avatar size="lg" color={avatarColor} initials={initials.toUpperCase()} />
          <div className="flex-1 min-w-0">
            <div className="type-label !text-red">Your profile</div>
            <h1 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.1] mt-1">
              {player.first_name}, welcome back.
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              {program?.name ?? "Your program"} · {levelLabel}
              {player.positions?.length > 0 ? ` · ${player.positions.join("/")}` : ""}
              {player.player_number ? ` · #${player.player_number}` : ""}
            </p>
          </div>
          <MeHeaderActions handle={player.profile_slug} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 lg:gap-7">
          {/* Main column */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Availability */}
            <AvailabilityCard
              status={player.availability_status ?? "ok"}
              note={player.availability_note ?? null}
            />

            {/* Upcoming schedule */}
            <div className="bg-card border border-hair rounded-lg">
              <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-ink-3" />
                <h3 className="font-display text-[15px] font-semibold tracking-tight">
                  Your upcoming schedule
                </h3>
                <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                  {myGames.length} GAMES · {(practices ?? []).length} PRACTICES
                </span>
              </div>
              <div>
                {myGames.length === 0 && (practices ?? []).length === 0 ? (
                  <div className="p-10 text-center text-[13px] text-ink-3">
                    No upcoming events on the calendar yet.
                  </div>
                ) : (
                  <>
                    {myGames.slice(0, 5).map((g) => {
                      const d = new Date(`${g.game_date}T00:00:00`);
                      const hasPrep = Boolean(
                        g.report_time ||
                          g.release_time ||
                          g.uniform ||
                          g.equipment_notes ||
                          g.lineup_preview ||
                          g.prep_notes,
                      );
                      return (
                        <div
                          key={g.id}
                          className="border-b border-hair-2 last:border-b-0"
                        >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-[52px] text-center shrink-0">
                            <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.08em]">
                              {d.toLocaleDateString("en-US", { weekday: "short" })}
                            </div>
                            <div className="font-display text-[20px] font-semibold tracking-[-0.02em] leading-none mt-0.5">
                              {d.getDate()}
                            </div>
                            <div className="text-[9px] text-ink-3 uppercase tracking-[0.08em] font-bold mt-0.5">
                              {d.toLocaleDateString("en-US", { month: "short" })}
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-xs bg-red-soft text-red flex items-center justify-center shrink-0">
                            <Swords className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] font-semibold">
                              {g.home_away === "home" ? "vs" : "@"} {g.opponent}
                            </div>
                            <div className="mt-0.5 text-[11.5px] text-ink-3 flex items-center gap-2">
                              {g.game_time && <span>{g.game_time.slice(0, 5)}</span>}
                              {g.location && (
                                <>
                                  <span className="text-ink-4">·</span>
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{g.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-xs bg-red-soft text-red text-[10px] font-bold uppercase tracking-[0.04em]">
                            Game
                          </span>
                        </div>
                        {hasPrep && (
                          <div className="mx-4 mb-3 p-3 bg-paper border-l-[3px] border-l-red rounded-sm space-y-1.5 text-[12px]">
                            <div className="type-label !text-red">Game-day prep</div>
                            <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1">
                              {g.report_time && (
                                <>
                                  <div className="text-ink-3 font-semibold">Report</div>
                                  <div className="font-mono font-semibold">
                                    {formatTimeForMe(g.report_time)}
                                  </div>
                                </>
                              )}
                              {g.release_time && (
                                <>
                                  <div className="text-ink-3 font-semibold">Released</div>
                                  <div className="font-mono font-semibold">
                                    {formatTimeForMe(g.release_time)}
                                  </div>
                                </>
                              )}
                              {g.uniform && (
                                <>
                                  <div className="text-ink-3 font-semibold">Uniform</div>
                                  <div className="font-semibold">{g.uniform}</div>
                                </>
                              )}
                              {g.equipment_notes && (
                                <>
                                  <div className="text-ink-3 font-semibold">Equipment</div>
                                  <div>{g.equipment_notes}</div>
                                </>
                              )}
                              {g.lineup_preview && (
                                <>
                                  <div className="text-ink-3 font-semibold">Lineup</div>
                                  <div>{g.lineup_preview}</div>
                                </>
                              )}
                              {g.prep_notes && (
                                <>
                                  <div className="text-ink-3 font-semibold">Notes</div>
                                  <div>{g.prep_notes}</div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        </div>
                      );
                    })}
                    {(practices ?? []).slice(0, 3).map((p) => {
                      const d = new Date(`${p.practice_date}T00:00:00`);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 px-4 py-3 border-b border-hair-2 last:border-b-0"
                        >
                          <div className="w-[52px] text-center shrink-0">
                            <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.08em]">
                              {d.toLocaleDateString("en-US", { weekday: "short" })}
                            </div>
                            <div className="font-display text-[20px] font-semibold tracking-[-0.02em] leading-none mt-0.5">
                              {d.getDate()}
                            </div>
                            <div className="text-[9px] text-ink-3 uppercase tracking-[0.08em] font-bold mt-0.5">
                              {d.toLocaleDateString("en-US", { month: "short" })}
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-xs bg-grass-dim text-grass flex items-center justify-center shrink-0">
                            <Dumbbell className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] font-semibold">{p.title}</div>
                            <div className="mt-0.5 text-[11.5px] text-ink-3">
                              {p.team_level ?? "All levels"}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-xs bg-paper-deep text-ink-2 text-[10px] font-bold uppercase tracking-[0.04em]">
                            Practice
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Season batting stats */}
            {seasonLine && seasonLine.games > 0 && (
              <div className="bg-card border border-hair rounded-lg">
                <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">
                    Your season · {seasonLine.seasonYear}
                  </h3>
                  <span className="ml-auto text-[11.5px] text-ink-3">
                    live from game-by-game events
                  </span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <div className={cn(
                        "font-mono text-[32px] font-bold tracking-[-0.03em] leading-none",
                        seasonLine.ba >= 0.3 && "text-red",
                      )}>
                        {formatAvg(seasonLine.ba)}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
                        AVG
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[32px] font-bold tracking-[-0.03em] leading-none">
                        {formatAvg(seasonLine.obp)}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
                        OBP
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[32px] font-bold tracking-[-0.03em] leading-none">
                        {formatAvg(seasonLine.slg)}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
                        SLG
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
                    {[
                      ["G", seasonLine.games],
                      ["AB", seasonLine.ab],
                      ["H", seasonLine.h],
                      ["HR", seasonLine.hr],
                      ["RBI", seasonLine.rbi],
                      ["BB", seasonLine.bb],
                      ["K", seasonLine.k],
                      ["OPS", formatAvg(seasonLine.ops)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="bg-paper rounded-sm py-1.5">
                        <div className="font-mono text-[14px] font-semibold">
                          {value}
                        </div>
                        <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  {careerLine && careerLine.games > seasonLine.games && (
                    <div className="mt-4 pt-3 border-t border-hair-2 text-[11.5px] text-ink-3 font-mono">
                      Career: {careerLine.games}G · {formatAvg(careerLine.ba)}/{formatAvg(careerLine.obp)}/{formatAvg(careerLine.slg)} · {careerLine.hr} HR · {careerLine.rbi} RBI
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Season pitching stats */}
            {pitchingSeason && pitchingSeason.games > 0 && (
              <div className="bg-card border border-hair rounded-lg">
                <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">
                    Your pitching · {pitchingSeason.seasonYear}
                  </h3>
                  <span className="ml-auto text-[11.5px] text-ink-3">
                    live from every batter you faced
                  </span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <div className={cn(
                        "font-mono text-[32px] font-bold tracking-[-0.03em] leading-none",
                        pitchingSeason.era > 0 && pitchingSeason.era < 3.0 && "text-red",
                      )}>
                        {formatERA(pitchingSeason.era)}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
                        ERA
                      </div>
                    </div>
                    <div>
                      <div className={cn(
                        "font-mono text-[32px] font-bold tracking-[-0.03em] leading-none",
                        pitchingSeason.whip > 0 && pitchingSeason.whip < 1.2 && "text-red",
                      )}>
                        {formatWHIP(pitchingSeason.whip)}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
                        WHIP
                      </div>
                    </div>
                    <div>
                      <div className={cn(
                        "font-mono text-[32px] font-bold tracking-[-0.03em] leading-none",
                        pitchingSeason.k9 >= 10 && "text-red",
                      )}>
                        {pitchingSeason.k9 > 0 ? pitchingSeason.k9.toFixed(1) : "—"}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
                        K/9
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
                    {[
                      ["G", String(pitchingSeason.games)],
                      ["IP", formatIP(pitchingSeason.ip)],
                      ["K", String(pitchingSeason.k)],
                      ["BB", String(pitchingSeason.bb)],
                      ["H", String(pitchingSeason.h)],
                      ["HR", String(pitchingSeason.hr)],
                      ["R", String(pitchingSeason.r)],
                      ["BF", String(pitchingSeason.bf)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="bg-paper rounded-sm py-1.5">
                        <div className="font-mono text-[14px] font-semibold">
                          {value}
                        </div>
                        <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  {pitchingCareer && pitchingCareer.games > pitchingSeason.games && (
                    <div className="mt-4 pt-3 border-t border-hair-2 text-[11.5px] text-ink-3 font-mono">
                      Career: {pitchingCareer.games}G · {formatIP(pitchingCareer.ip)} IP · {formatERA(pitchingCareer.era)} ERA · {pitchingCareer.k} K · {formatWHIP(pitchingCareer.whip)} WHIP
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Measurables */}
            {measurables.length > 0 && (
              <div className="bg-card border border-hair rounded-lg">
                <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">
                    Your verified measurables
                  </h3>
                  <span className="ml-auto text-[11.5px] text-ink-3">
                    from tryouts · scoutable
                  </span>
                </div>
                <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {measurables.map((m) => (
                    <div key={m.shortCode} className="p-3.5 bg-paper rounded-md">
                      <div className="font-mono text-[22px] font-semibold tracking-[-0.02em]">
                        {formatMeasurable(m)}
                        {m.unit && (
                          <span className="text-[11px] text-ink-3 ml-0.5 font-normal">
                            {m.unit}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-1">
                        {m.stationName}
                      </div>
                      {m.verifiedByCoachName && (
                        <div className="text-[10px] text-grass mt-0.5 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          verified
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Side column */}
          <div className="flex flex-col gap-5">
            <div className="bg-card border border-hair rounded-lg p-5">
              <div className="type-label">Public profile</div>
              <div className="mt-3 px-3 py-2.5 bg-paper rounded-md font-mono text-[11.5px] flex items-center gap-2">
                <span className="text-ink-3">rostr.app/p/</span>
                <b className="text-red truncate">{player.profile_slug}</b>
              </div>
              <Link
                href={`/p/${player.profile_slug}`}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
              >
                View public profile →
              </Link>
              <p className="text-[11px] text-ink-3 mt-2 leading-relaxed">
                This is what college coaches see. Shareable by link.
              </p>
            </div>

            {/* Messages — real inbox summary */}
            <div className="bg-card border border-hair rounded-lg p-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-ink-3" />
                <div className="type-label">Messages</div>
                {unreadMessages > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red text-white text-[10px] font-bold px-1">
                    {unreadMessages}
                  </span>
                )}
              </div>
              {pendingRequests.length > 0 && (
                <div className="mt-3 p-3 bg-red-soft rounded-sm">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red uppercase tracking-[0.06em]">
                    <Sparkles className="w-3 h-3" />
                    {pendingRequests.length} recruiter{" "}
                    {pendingRequests.length === 1 ? "request" : "requests"}
                  </div>
                  <div className="text-[12px] text-ink-2 mt-1">
                    A college coach wants to connect with you.
                  </div>
                </div>
              )}
              <Link
                href="/me/messages"
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
              >
                {unreadMessages + pendingRequests.length > 0 ? "Open inbox" : "Check inbox"}
                {" →"}
              </Link>
            </div>

            <div className="bg-card border border-hair rounded-lg p-5">
              <div className="type-label">Quick actions</div>
              <div className="mt-3 flex flex-col gap-2">
                <QuickAction label="Upload a highlight" feature="Upload highlight" detail="Mux video upload + recruiter push — next sprint." />
                <QuickAction label="Edit academics" feature="Edit academics" detail="GPA / test scores / target schools — next sprint." />
                <QuickAction label="Privacy + visibility" feature="Privacy settings" detail="Control what's public vs. recruiter-only — next sprint." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoProfileFound() {
  return (
    <div className="bg-paper min-h-screen flex items-center justify-center p-4">
      <div className="max-w-[460px] w-full bg-card border border-hair rounded-lg p-6 sm:p-8">
        <div className="w-11 h-11 rounded-full bg-amber-soft text-amber inline-flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          No player profile linked yet
        </h1>
        <p className="text-[13px] text-ink-3 mt-2 leading-relaxed">
          Your account isn&apos;t linked to a player profile yet. Ask your coach
          to send you a claim link — it looks like{" "}
          <span className="font-mono text-[11.5px]">rostr.app/claim/&lt;token&gt;</span>.
          Once you claim, your schedule, availability, and verified measurables
          all live here.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-sm text-[12.5px] font-semibold"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function AvailabilityCard({
  status,
  note,
}: {
  status: string;
  note: string | null;
}) {
  const config: Record<string, { bg: string; dot: string; label: string; desc: string }> = {
    ok: {
      bg: "bg-grass-dim text-grass",
      dot: "bg-grass",
      label: "Available",
      desc: "You're good to go for the next practice + game.",
    },
    questionable: {
      bg: "bg-amber-soft text-amber",
      dot: "bg-amber",
      label: "Questionable",
      desc: "Coach has you as a question mark. Update if anything changes.",
    },
    out: {
      bg: "bg-red-soft text-red",
      dot: "bg-red",
      label: "Out",
      desc: "Coach has you marked out. Let them know when you're cleared.",
    },
  };
  const s = config[status] ?? config.ok;
  return (
    <div className={cn("rounded-lg p-5 border border-hair", s.bg)}>
      <div className="flex items-center gap-2.5">
        <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", s.dot)} />
        <div className="font-display text-[18px] font-semibold tracking-tight">{s.label}</div>
      </div>
      <div className="text-[12.5px] opacity-90 mt-1">{s.desc}</div>
      {note && (
        <div className="mt-3 px-3 py-2 bg-card rounded-sm text-[12px] text-ink-2">
          <span className="font-semibold">Note: </span>
          {note}
        </div>
      )}
    </div>
  );
}

function formatMeasurable(m: {
  bestValue: number;
  scoreType: string;
  unit?: string | null;
}): string {
  if (m.scoreType === "rating") return m.bestValue.toFixed(1);
  if (m.unit === "s") return m.bestValue.toFixed(2);
  return m.bestValue.toFixed(1).replace(/\.0$/, "");
}

function formatTimeForMe(t: string): string {
  // t like "14:30:00" or "14:30"
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${(mStr ?? "00").padStart(2, "0")} ${period}`;
}
