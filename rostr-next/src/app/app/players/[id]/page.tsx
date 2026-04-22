import { notFound, redirect } from "next/navigation";
import { MOCK_PLAYERS } from "@/lib/mock-data";

/**
 * /app/players/[id] — Coach-internal view of a player.
 * For now, routes the coach to the public profile at /p/[handle].
 * Future: embed the profile in the app shell + expose coach-only
 * tabs (notes, medical, eligibility, comms).
 */
export default function CoachPlayerPage({ params }: { params: { id: string } }) {
  const player =
    MOCK_PLAYERS.find((p) => p.id === params.id) ??
    MOCK_PLAYERS.find((p) => p.handle === params.id);
  if (!player) notFound();
  redirect(`/p/${player.handle}`);
}
