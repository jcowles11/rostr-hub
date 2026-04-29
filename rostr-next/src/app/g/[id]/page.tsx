import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fetchLiveGameState, fetchGameEvents } from "@/lib/services/live-scoring";
import { FanGameView, type LineupSlot, type PlayerLink } from "./fan-game-view";

/**
 * /g/[id] — public fan viewer for a game.
 *
 * Uses the public views `live_game_snapshot` + `public_game_events` so
 * no auth is required. Realtime subscription keeps the page live while
 * the coach is scoring on their phone.
 *
 * Server-side enrichment (added in the In-Game Scoring UX sprint):
 *   - `playerLinks`: id → { handle, jersey, season BA } map so the
 *     play-by-play can render `<Link href="/p/{handle}">` and inline
 *     stat chips without a per-row fetch on the client.
 *   - `lineup`: ordered batting slots so the scoreboard can show
 *     "Now batting" + "On deck" derived from the last at-bat's player.
 *   - Both are read-only and use ALREADY-PUBLIC tables/views; no new
 *     RLS surface area added.
 */
export default async function FanGamePage({
  params,
}: {
  params: { id: string };
}) {
  const [state, events] = await Promise.all([
    fetchLiveGameState(params.id),
    fetchGameEvents(params.id, 100),
  ]);
  if (!state) notFound();

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServerClient();

  // Header + program context (opponent name, date). The snapshot view
  // carries what we need; game_date comes from the underlying games row
  // via a separate read.
  const { data: gameRow } = await supabase
    .from("games")
    .select("name, opponent, game_date, game_time, location, home_away, team_level, program_id, programs:program_id(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!gameRow) notFound();

  const program = Array.isArray(gameRow.programs) ? gameRow.programs[0] : gameRow.programs;
  const dateLabel = format(parseISO(gameRow.game_date), "EEEE · MMM d");

  // Build the player-id → link map for every player who appears in the
  // event stream. Single batched query against `players` (already
  // readable by anon for public-facing flows like profile linking).
  const playerIds = Array.from(
    new Set(
      events
        .map((e) => e.playerId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  let playerLinks: Record<string, PlayerLink> = {};
  if (playerIds.length > 0) {
    const { data: rows } = await supabase
      .from("players")
      .select("id, profile_slug, player_number")
      .in("id", playerIds);
    for (const r of rows ?? []) {
      playerLinks[r.id] = {
        id: r.id,
        handle: r.profile_slug ?? null,
        jersey: r.player_number ?? null,
        ba: null, // populated below if season batting exists
      };
    }
    // Pull season BA in one batched read so the play feed can show
    // ".318" inline next to the batter without N round-trips.
    const seasonYear = parseISO(gameRow.game_date).getFullYear();
    const { data: batting } = await supabase
      .from("player_imported_batting")
      .select("player_id, ba")
      .eq("program_id", gameRow.program_id)
      .eq("season_year", seasonYear)
      .in("player_id", playerIds);
    for (const b of batting ?? []) {
      if (playerLinks[b.player_id]) {
        playerLinks[b.player_id].ba = typeof b.ba === "number" ? b.ba : null;
      }
    }
  }

  // Lineup for the home (our) team, used to derive Now batting + On deck.
  // Only meaningful when our team is at bat; if the opposing-side stream
  // ever exists we'd repeat for them. For v1 we only get our lineup.
  let lineup: LineupSlot[] = [];
  {
    const { data: rows } = await supabase
      .from("lineup_entries")
      .select(
        "batting_order, position, player_id, players:player_id(first_name, last_name, player_number, profile_slug)",
      )
      .eq("game_id", params.id)
      .order("batting_order", { ascending: true });
    for (const r of rows ?? []) {
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      if (!p) continue;
      lineup.push({
        battingOrder: r.batting_order,
        position: r.position,
        playerId: r.player_id,
        firstName: p.first_name,
        lastName: p.last_name,
        jersey: p.player_number ?? null,
        handle: p.profile_slug ?? null,
      });
    }
  }

  // Our program's roster — used to resolve runner-on-base names + the
  // active pitcher (whose id lives in payload.pitcherId on at_bats but
  // who probably isn't in the playerLinks-from-events map until they
  // appear as a batter). One small query, ~30-row pages at pilot scale.
  {
    const { data: rosterRows } = await supabase
      .from("players")
      .select("id, first_name, last_name, player_number, profile_slug")
      .eq("program_id", gameRow.program_id);
    for (const r of rosterRows ?? []) {
      // Don't clobber existing entries (which may already have a `ba`
      // populated from the season-batting query above).
      if (!playerLinks[r.id]) {
        playerLinks[r.id] = {
          id: r.id,
          handle: r.profile_slug ?? null,
          jersey: r.player_number ?? null,
          ba: null,
        };
      } else if (!playerLinks[r.id].handle) {
        playerLinks[r.id].handle = r.profile_slug ?? null;
      }
      // Stash a `name` extension on the link so the fan view can
      // resolve runner ids → names without yet another fetch.
      (playerLinks[r.id] as PlayerLink & { name?: string }).name =
        `${r.first_name} ${r.last_name}`.trim();
    }
  }

  return (
    <FanGameView
      gameId={params.id}
      programName={program?.name ?? "Team"}
      game={{
        opponent: gameRow.opponent ?? "Opponent",
        dateLabel,
        timeLabel: gameRow.game_time ? String(gameRow.game_time).slice(0, 5) : "",
        location: gameRow.location ?? "",
        level: gameRow.team_level,
        home: gameRow.home_away === "home",
      }}
      initialState={state}
      initialEvents={events}
      playerLinks={playerLinks}
      lineup={lineup}
    />
  );
}
