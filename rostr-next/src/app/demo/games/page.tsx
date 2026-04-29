import { GamesView } from "@/app/app/games/games-view";
import { getMockGames } from "@/lib/mock-data";

/**
 * /demo/games — same client view as /app/games, dynamic game list
 * anchored on the upcoming Friday Senior Night so the upcoming /
 * recent split always reflects the actual current date.
 */
export const metadata = {
  title: "Games · Demo · Rostr",
  robots: { index: false, follow: false },
};

// Anchor on the actual current date on every render.
export const dynamic = "force-dynamic";

export default function DemoGamesPage() {
  return <GamesView games={getMockGames()} />;
}
