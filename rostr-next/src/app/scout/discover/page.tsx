import { redirect } from "next/navigation";
import { requireFlag } from "@/lib/feature-flags";
import {
  getCurrentRecruiter,
  searchPlayers,
  type SearchFilters,
  type PlayerSearchResult,
} from "@/lib/services/recruiter";
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

  // 4. Run the search. searchPlayers gates on profile_public=true.
  const { players: rawPlayers } = await searchPlayers(filters);

  // 5. Apply the verified-data-only filter on the server so the wire
  //    payload is already pruned. "Has verified data" is currently
  //    defined as any non-null measurable from the tryout system.
  const players = verifiedOnly
    ? rawPlayers.filter(hasAnyVerifiedSignal)
    : rawPlayers;

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

/**
 * "Has any verified signal" — for v1, any populated tryout measurable
 * counts. The underlying tryout_scores table is coach-recorded so each
 * row is a verified data point.
 *
 * NOTE: this does NOT yet include verified highlight or verified prior-
 * stat counts (added by migrations 35 + 37). Those exist on per-player
 * fetches but the search view doesn't expose counts. A future iteration
 * can add `has_verified_clip` / `has_verified_prior_stat` to the
 * player_search view; for v1 the measurable signal is sufficient.
 */
function hasAnyVerifiedSignal(p: PlayerSearchResult): boolean {
  return Boolean(
    p.best60yd != null ||
      p.bestEV != null ||
      p.bestVelo != null ||
      p.bestField != null ||
      p.bestBP != null,
  );
}

