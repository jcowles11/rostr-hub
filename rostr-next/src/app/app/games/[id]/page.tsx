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
  const { game, rosterPlayerIds } = await fetchGameDetail(params.id);

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
        }}
        players={MOCK_PLAYERS}
        initialRosterIds={MOCK_PLAYERS.filter((p) => p.level === "V").map((p) => p.id)}
      />
    );
  }

  if (!game) notFound();

  const dateLabel = format(parseISO(game.gameDate), "EEEE · MMM d");
  const timeLabel = game.gameTime ? game.gameTime.slice(0, 5) : "";
  const isHome = game.homeAway === "home";

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
      }}
      players={players.length > 0 ? players : MOCK_PLAYERS}
      initialRosterIds={rosterPlayerIds}
    />
  );
}
