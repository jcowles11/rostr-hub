import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { GameView } from "./game-view";
import { fetchGameDetail } from "@/lib/services/game";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { MOCK_PLAYERS, type MockPlayer } from "@/lib/mock-data";

/**
 * /app/games/[id] — Game day server shell.
 * Loads the game + the coach's full program roster + which players are
 * already on the game roster. Falls back to mock data when the ID
 * doesn't match a real row (e.g. demo IDs like "g1" from the landing
 * page or a brand-new account without saved games).
 */
export default async function GamePage({ params }: { params: { id: string } }) {
  const coach = await getCurrentCoach();
  const { game, rosterPlayerIds, lineup } = await fetchGameDetail(params.id);

  let players: MockPlayer[] = [];
  if (coach) {
    const real = await fetchRoster(coach.program_id);
    players = real as unknown as MockPlayer[];
  }

  // Unknown game id AND we have no coach → 404 for public; otherwise
  // fall back to mock "vs Central Hawks" so demo accounts still render.
  if (!game && !coach) {
    // Pretend to render with mock demo data so the landing-page demo links work.
    return (
      <GameView
        gameId={params.id}
        programName="Demo · Lincoln HS"
        game={{
          opponent: "Central Hawks",
          dateLabel: "Friday · Apr 24 · Conference",
          timeLabel: "5:00 PM",
          location: "Lincoln HS · Main field",
          level: "Varsity",
          home: true,
          status: "scheduled",
          ourScore: null,
          opponentScore: null,
          result: null,
          recapNotes: null,
        }}
        players={MOCK_PLAYERS}
        initialRosterIds={MOCK_PLAYERS.filter((p) => p.level === "V").map((p) => p.id)}
        initialLineup={[]}
      />
    );
  }

  if (!game) notFound();

  const dateLabel = format(parseISO(game.gameDate), "EEEE · MMM d");
  const timeLabel = game.gameTime ? game.gameTime.slice(0, 5) : "";
  const isHome = game.homeAway === "home";

  // Auto-populate the game roster from the program roster when no
  // per-game selections have been made yet. Coaches shouldn't have to
  // re-pick their team for every game — they start with everyone
  // included and uncheck who's unavailable.
  const effectiveRosterIds =
    rosterPlayerIds.length > 0 ? rosterPlayerIds : players.map((p) => p.id);

  return (
    <GameView
      gameId={game.id}
      programName={coach?.program_name ?? "Your program"}
      game={{
        opponent: game.opponent ?? "Opponent TBD",
        dateLabel,
        timeLabel,
        location: game.location ?? (isHome ? "Home" : "Away"),
        level: game.teamLevel,
        home: isHome,
        status: game.status,
        ourScore: game.ourScore,
        opponentScore: game.opponentScore,
        result: game.result,
        recapNotes: game.recapNotes,
        opponentProgramId: game.opponentProgramId,
        liveStatus: game.liveStatus,
        reportTime: game.reportTime,
        releaseTime: game.releaseTime,
        uniform: game.uniform,
        equipmentNotes: game.equipmentNotes,
        lineupPreview: game.lineupPreview,
        prepNotes: game.prepNotes,
        shareLineup: game.shareLineup,
        scorekeeperName: game.scorekeeperName,
      }}
      players={players}
      initialRosterIds={effectiveRosterIds}
      initialLineup={lineup}
    />
  );
}
