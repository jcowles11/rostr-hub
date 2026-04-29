import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchGameDetail } from "@/lib/services/game";
import { fetchLiveGameState, fetchGameEvents, fetchOpposingRoster } from "@/lib/services/live-scoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveScoringView } from "./live-scoring-view";

/**
 * /app/games/[id]/score — live in-app scoring for a coach.
 *
 * Mobile-first UX: coach opens this on their phone mid-game and taps
 * outcomes. Events stream to the DB via append-only writes; the fan
 * viewer at /g/[id] subscribes to the same channel.
 */
export default async function LiveScoringPage({
  params,
}: {
  params: { id: string };
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const [{ game }, state, initialEvents] = await Promise.all([
    fetchGameDetail(params.id),
    fetchLiveGameState(params.id),
    fetchGameEvents(params.id, 50),
  ]);
  if (!game || !state) notFound();

  // Pull our roster + lineup for the current game
  const supabase = createSupabaseServerClient();
  const [rosterRes, lineupRes] = await Promise.all([
    supabase
      .from("game_rosters")
      .select("player_id, players:player_id(first_name, last_name, player_number, positions)")
      .eq("game_id", params.id),
    supabase
      .from("lineup_entries")
      .select("player_id, batting_order, position, players:player_id(first_name, last_name, player_number, positions)")
      .eq("game_id", params.id)
      .order("batting_order", { ascending: true }),
  ]);

  const ourRoster = (rosterRes.data ?? [])
    .map((r) => {
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      if (!p) return null;
      return {
        id: r.player_id,
        firstName: (p as { first_name: string }).first_name,
        lastName: (p as { last_name: string }).last_name,
        jersey: (p as { player_number: number | null }).player_number ?? null,
        positions: ((p as { positions?: string[] }).positions ?? []) as string[],
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const lineup = (lineupRes.data ?? [])
    .map((r) => {
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      if (!p) return null;
      return {
        battingOrder: r.batting_order,
        position: r.position,
        playerId: r.player_id,
        firstName: (p as { first_name: string }).first_name,
        lastName: (p as { last_name: string }).last_name,
        jersey: (p as { player_number: number | null }).player_number ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // If cross-team linked, pull the opposing roster for tap-to-log
  const opposingRoster = await fetchOpposingRoster(params.id);

  const dateLabel = format(parseISO(game.gameDate), "EEEE · MMM d");
  const isHome = game.homeAway === "home";

  return (
    <LiveScoringView
      gameId={params.id}
      programName={coach.program_name}
      game={{
        opponent: game.opponent ?? "Opponent",
        dateLabel,
        level: game.teamLevel,
        home: isHome,
      }}
      initialState={state}
      initialEvents={initialEvents}
      ourRoster={ourRoster}
      ourLineup={lineup}
      opposingRoster={opposingRoster}
    />
  );
}
