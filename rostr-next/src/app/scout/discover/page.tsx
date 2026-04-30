import { redirect } from "next/navigation";
import { requireFlag } from "@/lib/feature-flags";
import {
  getCurrentRecruiter,
  type SearchFilters,
} from "@/lib/services/recruiter";
import { searchPlayersForScout } from "@/lib/services/scout-signal";
import { ScoutDiscoverView } from "./discover-view";

/**
 * /scout/discover — Scout Discovery V1 (flag-gated).
 *
 * Simplified parallel surface to /scout/page.tsx. Where the existing
 * /scout page exposes the full recruiter feature surface (lists,
 * outreach, saved searches, dozens of filters), this surface is the
 * minimum-viable "search → scan → click" experience the brief calls for:
 *
 *   - one search box
 *   - three filters: position, grad year, verified-data-only toggle
 *   - a flat grid of player cards
 *   - click → /p/[handle]
 *
 * Reuses `searchPlayers` so the privacy + RLS gates we already trust
 * stay the same — `profile_public = true` is enforced inside the
 * fetcher. The verified-data-only toggle is applied as a client-side
 * filter after the server fetch (any player with a populated tryout
 * measurable counts as "has verified data" for v1; the underlying
 * tryout_scores table is coach-recorded, so those numbers are
 * verified by definition).
 *
 * Auth: the parent /scout layout already enforces a logged-in user
 * with a recruiter record (or redirects to /scout/setup). We treat
 * existing recruiters as scouts in v1; a true "scout" role is a
 * future iteration once the discovery UX is settled.
 *
 * Flag gate: requireFlag returns 404 in production. The route does
 * not exist on the live pilot.
 */

export const metadata = {
  title: "Discover · Scout · Rostr",
  robots: { index: false, follow: false },
};

export default async function ScoutDiscoverPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    pos?: string; // comma-separated positions
    class?: string; // comma-separated class years
    verified?: string; // "1" / "true" enables verified-only filter
  };
}) {
  // 1. Flag gate. 404 in production.
  requireFlag("NEXT_PUBLIC_ENABLE_SCOUT_MODE");

  // 2. Auth: must be a recruiter (parent layout would otherwise have
  //    redirected, but we re-check defensively for safety).
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) {
    redirect("/scout/setup");
  }

  // 3. Build SearchFilters from URL state. Parse the same way the
  //    existing /scout page does so behavior is consistent.
  const filters: SearchFilters = {
    query: searchParams.q,
    positions: parseCSV(searchParams.pos),
    gradeYears: parseCSV(searchParams.class)
      ?.map((s) => Number(s))
      .filter((n) => !Number.isNaN(n)),
    limit: 60,
    offset: 0,
  };

  const verifiedOnly =
    searchParams.verified === "1" || searchParams.verified === "true";

  // 4. Run the ranked search. searchPlayersForScout:
  //    - reuses searchPlayers (profile_public=true gate)
  //    - attaches per-player signal counts via player_scout_signal view
  //    - drops zero-score players when verifiedOnly=true (improved
  //      from v1's "has any tryout measurable" check — now keys on
  //      computed signalScore which folds in highlights + prior stats
  //      + measurables + recency)
  //    - sorts by signalScore DESC, name ASC for stable secondary order
  const { players } = await searchPlayersForScout({
    ...filters,
    verifiedOnly,
  });

  return (
    <ScoutDiscoverView
      recruiterName={recruiter.fullName}
      initialFilters={{
        query: searchParams.q ?? "",
        positions: parseCSV(searchParams.pos) ?? [],
        gradeYears: parseCSV(searchParams.class) ?? [],
        verifiedOnly,
      }}
      players={players}
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function parseCSV(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  const arr = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length === 0 ? undefined : arr;
}

