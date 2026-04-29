import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Recruiter service — queries for the /scout surface.
 * Mirrors the coach/ service pattern: recruiter context, search, lists.
 */

export interface RecruiterContext {
  id: string;
  userId: string;
  fullName: string;
  organizationName: string;
  organizationShort: string | null;
  organizationDivision:
    | "d1"
    | "d2"
    | "d3"
    | "naia"
    | "juco"
    | "pro"
    | "club"
    | "other"
    | null;
  title: string | null;
  sport: string;
  region: string | null;
  contactEmail: string | null;
  avatarColor: string | null;
  verified: boolean;
}

/**
 * Returns the recruiter record (if any) for the signed-in user.
 * Returns null if no auth user, or the user is not a recruiter.
 */
export async function getCurrentRecruiter(): Promise<RecruiterContext | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("recruiters")
    .select(
      "id, user_id, full_name, organization_name, organization_short, organization_division, title, sport, region, contact_email, avatar_color, verified",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    fullName: data.full_name,
    organizationName: data.organization_name,
    organizationShort: data.organization_short,
    organizationDivision: data.organization_division as RecruiterContext["organizationDivision"],
    title: data.title,
    sport: data.sport,
    region: data.region,
    contactEmail: data.contact_email,
    avatarColor: data.avatar_color,
    verified: data.verified,
  };
}

// ── Search ───────────────────────────────────────────────────────

/**
 * Search filter vocabulary. Every field is optional — an empty filter
 * set returns every public player in the universe.
 */
export interface SearchFilters {
  query?: string; // name substring
  positions?: string[]; // ["SS", "2B"]
  gradeYears?: number[]; // [2026, 2027]
  max60yd?: number | null;
  minEV?: number | null;
  minVelo?: number | null;
  minField?: number | null;
  minBP?: number | null;
  /** Real-stats filters, derived from player_season_batting view. */
  minBA?: number | null;
  minOPS?: number | null;
  minHR?: number | null;
  /** Pitching-stats filters, derived from player_season_pitching view. */
  minIP?: number | null;
  maxERA?: number | null;
  maxWHIP?: number | null;
  minK9?: number | null;
  /** Optional sort preset. Defaults to best_ev desc. */
  sort?:
    | "best_ev_desc"
    | "best_60yd_asc"
    | "best_velo_desc"
    | "name_asc"
    | "grade_asc"
    | "ba_desc"
    | "ops_desc"
    | "era_asc"
    | "k9_desc";
  /** Pagination. Defaults to 50. */
  limit?: number;
  offset?: number;
}

export interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  grade: number | null;
  positions: string[];
  jersey: number | null;
  schoolName: string | null;
  profileSlug: string;
  bats: string | null;
  throws: string | null;
  // Verified measurables (best-ever values across tryouts)
  best60yd: number | null;
  bestEV: number | null;
  bestVelo: number | null;
  bestField: number | null;
  bestBP: number | null;
  // Real season batting stats (if any)
  games: number | null;
  ba: number | null;
  ops: number | null;
  hr: number | null;
  // Real season pitching stats (if any)
  pitchingGames: number | null;
  ip: number | null;
  era: number | null;
  whip: number | null;
  k9: number | null;
}

/**
 * Derive "class year" from grade + today. Grade 12 graduates in the
 * current calendar year (if before June) or next year (if after June).
 * For v1 we use a simpler formula: grade 12 = current school year end.
 */
export function classYearForGrade(
  grade: number,
  today: Date = new Date(),
): number {
  const nowYear = today.getFullYear();
  const yearsRemaining = Math.max(0, 12 - grade);
  return nowYear + yearsRemaining;
}

export function gradeForClassYear(
  classYear: number,
  today: Date = new Date(),
): number {
  const nowYear = today.getFullYear();
  const yearsRemaining = classYear - nowYear;
  return 12 - Math.max(0, yearsRemaining);
}

export async function searchPlayers(
  filters: SearchFilters,
): Promise<{ players: PlayerSearchResult[]; total: number }> {
  const supabase = createSupabaseServerClient();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let q = supabase
    .from("player_search")
    .select(
      "id, first_name, last_name, grade, positions, player_number, profile_slug, bats, throws, school_name, best_60yd, best_ev, best_velo, best_field, best_bp",
      { count: "exact" },
    )
    .eq("profile_public", true);

  if (filters.query && filters.query.trim()) {
    const q2 = `%${filters.query.trim()}%`;
    q = q.or(`first_name.ilike.${q2},last_name.ilike.${q2}`);
  }

  if (filters.positions && filters.positions.length > 0) {
    q = q.overlaps("positions", filters.positions);
  }

  if (filters.gradeYears && filters.gradeYears.length > 0) {
    const grades = filters.gradeYears.map((cy) => gradeForClassYear(cy));
    q = q.in("grade", grades);
  }

  // Measurable filters: NULL-tolerant by default — if the player has no
  // score for that station we keep them (can't prove they don't meet
  // the threshold). A stricter filter set would opt-in to "only show
  // players with a measured X" — future work.
  if (filters.max60yd != null) {
    q = q.or(`best_60yd.is.null,best_60yd.lte.${filters.max60yd}`);
  }
  if (filters.minEV != null) {
    q = q.or(`best_ev.is.null,best_ev.gte.${filters.minEV}`);
  }
  if (filters.minVelo != null) {
    q = q.or(`best_velo.is.null,best_velo.gte.${filters.minVelo}`);
  }
  if (filters.minField != null) {
    q = q.or(`best_field.is.null,best_field.gte.${filters.minField}`);
  }
  if (filters.minBP != null) {
    q = q.or(`best_bp.is.null,best_bp.gte.${filters.minBP}`);
  }

  // Sort
  switch (filters.sort ?? "best_ev_desc") {
    case "best_ev_desc":
      q = q.order("best_ev", { ascending: false, nullsFirst: false });
      break;
    case "best_60yd_asc":
      q = q.order("best_60yd", { ascending: true, nullsFirst: false });
      break;
    case "best_velo_desc":
      q = q.order("best_velo", { ascending: false, nullsFirst: false });
      break;
    case "name_asc":
      q = q.order("last_name", { ascending: true }).order("first_name", { ascending: true });
      break;
    case "grade_asc":
      q = q.order("grade", { ascending: false }); // lower grade = older class year
      break;
  }

  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[recruiter] searchPlayers:", error);
    return { players: [], total: 0 };
  }

  // If the recruiter applied real-stats filters, fetch season batting
  // AND pitching rows for matching players and filter/enrich. This is
  // done post-query because these views live separately from
  // player_search.
  const playerIds = (data ?? []).map((p) => p.id);
  const battingByPlayer = new Map<
    string,
    { games: number; ba: number; ops: number; hr: number }
  >();
  const pitchingByPlayer = new Map<
    string,
    { games: number; ip: number; era: number; whip: number; k9: number; outs: number }
  >();
  if (playerIds.length > 0) {
    const [battingRes, pitchingRes, importedBatRes, importedPitRes] = await Promise.all([
      supabase
        .from("player_season_batting")
        .select("player_id, games, ba, ops, hr")
        .in("player_id", playerIds),
      supabase
        .from("player_season_pitching")
        .select("player_id, games, ip, era, whip, k9, outs")
        .in("player_id", playerIds),
      supabase
        .from("player_imported_batting")
        .select("player_id, games, ba, ops, hr, season_year")
        .in("player_id", playerIds)
        .order("season_year", { ascending: false }),
      supabase
        .from("player_imported_pitching")
        .select("player_id, games, ip, era, whip, k9, outs, season_year")
        .in("player_id", playerIds)
        .order("season_year", { ascending: false }),
    ]);
    // Fill with imported first (most recent season), then overwrite with
    // live data where it exists. Latest-season-first ordering means the
    // first row per player is the most recent.
    for (const r of importedBatRes.data ?? []) {
      if (!battingByPlayer.has(r.player_id)) {
        battingByPlayer.set(r.player_id, {
          games: r.games,
          ba: Number(r.ba),
          ops: Number(r.ops),
          hr: r.hr,
        });
      }
    }
    for (const r of importedPitRes.data ?? []) {
      if (!pitchingByPlayer.has(r.player_id)) {
        pitchingByPlayer.set(r.player_id, {
          games: r.games,
          ip: Number(r.ip),
          era: Number(r.era),
          whip: Number(r.whip),
          k9: Number(r.k9),
          outs: r.outs,
        });
      }
    }
    for (const r of battingRes.data ?? []) {
      if ((r.games ?? 0) > 0) {
        battingByPlayer.set(r.player_id, {
          games: r.games,
          ba: Number(r.ba),
          ops: Number(r.ops),
          hr: r.hr,
        });
      }
    }
    for (const r of pitchingRes.data ?? []) {
      if ((r.games ?? 0) > 0) {
        pitchingByPlayer.set(r.player_id, {
          games: r.games,
          ip: Number(r.ip),
          era: Number(r.era),
          whip: Number(r.whip),
          k9: Number(r.k9),
          outs: r.outs,
        });
      }
    }
  }

  const hasBattingFilter =
    filters.minBA != null || filters.minOPS != null || filters.minHR != null;
  const hasPitchingFilter =
    filters.minIP != null ||
    filters.maxERA != null ||
    filters.maxWHIP != null ||
    filters.minK9 != null;

  const withStatsFilter = (data ?? []).filter((p) => {
    if (hasBattingFilter) {
      const s = battingByPlayer.get(p.id);
      if (!s) return false;
      if (filters.minBA != null && s.ba < filters.minBA) return false;
      if (filters.minOPS != null && s.ops < filters.minOPS) return false;
      if (filters.minHR != null && s.hr < filters.minHR) return false;
    }
    if (hasPitchingFilter) {
      const s = pitchingByPlayer.get(p.id);
      if (!s) return false;
      if (filters.minIP != null && s.ip < filters.minIP) return false;
      if (filters.maxERA != null && s.era > filters.maxERA) return false;
      if (filters.maxWHIP != null && s.whip > filters.maxWHIP) return false;
      if (filters.minK9 != null && s.k9 < filters.minK9) return false;
    }
    return true;
  });

  // Optional client-side sort for stats-based sorts (can't ORDER BY a
  // joined-view column in the main query).
  if (filters.sort === "ba_desc") {
    withStatsFilter.sort((a, b) => {
      const sa = battingByPlayer.get(a.id)?.ba ?? -1;
      const sb = battingByPlayer.get(b.id)?.ba ?? -1;
      return sb - sa;
    });
  } else if (filters.sort === "ops_desc") {
    withStatsFilter.sort((a, b) => {
      const sa = battingByPlayer.get(a.id)?.ops ?? -1;
      const sb = battingByPlayer.get(b.id)?.ops ?? -1;
      return sb - sa;
    });
  } else if (filters.sort === "era_asc") {
    // Lower ERA is better. Pitchers with no data sort to the bottom.
    withStatsFilter.sort((a, b) => {
      const sa = pitchingByPlayer.get(a.id)?.era;
      const sb = pitchingByPlayer.get(b.id)?.era;
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb;
    });
  } else if (filters.sort === "k9_desc") {
    withStatsFilter.sort((a, b) => {
      const sa = pitchingByPlayer.get(a.id)?.k9 ?? -1;
      const sb = pitchingByPlayer.get(b.id)?.k9 ?? -1;
      return sb - sa;
    });
  }

  const hasAnyStatsFilter = hasBattingFilter || hasPitchingFilter;

  return {
    total: hasAnyStatsFilter ? withStatsFilter.length : count ?? 0,
    players: withStatsFilter.map((r) => {
      const batting = battingByPlayer.get(r.id);
      const pitching = pitchingByPlayer.get(r.id);
      return {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        grade: r.grade,
        positions: r.positions ?? [],
        jersey: r.player_number,
        schoolName: r.school_name,
        profileSlug: r.profile_slug,
        bats: r.bats,
        throws: r.throws,
        best60yd: r.best_60yd != null ? Number(r.best_60yd) : null,
        bestEV: r.best_ev != null ? Number(r.best_ev) : null,
        bestVelo: r.best_velo != null ? Number(r.best_velo) : null,
        bestField: r.best_field != null ? Number(r.best_field) : null,
        bestBP: r.best_bp != null ? Number(r.best_bp) : null,
        games: batting?.games ?? null,
        ba: batting?.ba ?? null,
        ops: batting?.ops ?? null,
        hr: batting?.hr ?? null,
        pitchingGames: pitching?.games ?? null,
        ip: pitching?.ip ?? null,
        era: pitching?.era ?? null,
        whip: pitching?.whip ?? null,
        k9: pitching?.k9 ?? null,
      };
    }),
  };
}

// ── Lists ────────────────────────────────────────────────────────

export interface RecruiterList {
  id: string;
  name: string;
  color: string | null;
  emoji: string | null;
  description: string | null;
  playerCount: number;
  createdAt: string;
}

export async function fetchLists(
  recruiterId: string,
): Promise<RecruiterList[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recruiter_lists")
    .select("id, name, color, emoji, description, created_at")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });
  if (error) return [];

  // Count players per list in a second query (cheap enough for v1)
  const ids = (data ?? []).map((l) => l.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: countData } = await supabase
      .from("recruiter_list_players")
      .select("list_id")
      .in("list_id", ids);
    for (const r of countData ?? []) {
      counts.set(r.list_id, (counts.get(r.list_id) ?? 0) + 1);
    }
  }

  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    emoji: l.emoji,
    description: l.description,
    playerCount: counts.get(l.id) ?? 0,
    createdAt: l.created_at,
  }));
}

export interface ListDetail {
  list: RecruiterList;
  players: Array<PlayerSearchResult & { notes: string | null; addedAt: string }>;
}

export async function fetchListDetail(
  listId: string,
): Promise<ListDetail | null> {
  const supabase = createSupabaseServerClient();
  const { data: listRow } = await supabase
    .from("recruiter_lists")
    .select("id, name, color, emoji, description, created_at")
    .eq("id", listId)
    .maybeSingle();
  if (!listRow) return null;

  const { data: members } = await supabase
    .from("recruiter_list_players")
    .select("player_id, notes, added_at")
    .eq("list_id", listId)
    .order("added_at", { ascending: false });

  const playerIds = (members ?? []).map((m) => m.player_id);
  const playersById = new Map<string, PlayerSearchResult>();
  if (playerIds.length > 0) {
    const [{ data: rows }, { data: battingRows }, { data: pitchingRows }] =
      await Promise.all([
        supabase
          .from("player_search")
          .select(
            "id, first_name, last_name, grade, positions, player_number, profile_slug, bats, throws, school_name, best_60yd, best_ev, best_velo, best_field, best_bp",
          )
          .in("id", playerIds),
        supabase
          .from("player_season_batting")
          .select("player_id, games, ba, ops, hr")
          .in("player_id", playerIds),
        supabase
          .from("player_season_pitching")
          .select("player_id, games, ip, era, whip, k9")
          .in("player_id", playerIds),
      ]);
    const battingByPlayer = new Map<
      string,
      { games: number; ba: number; ops: number; hr: number }
    >();
    for (const r of battingRows ?? []) {
      battingByPlayer.set(r.player_id, {
        games: r.games,
        ba: Number(r.ba),
        ops: Number(r.ops),
        hr: r.hr,
      });
    }
    const pitchingByPlayer = new Map<
      string,
      { games: number; ip: number; era: number; whip: number; k9: number }
    >();
    for (const r of pitchingRows ?? []) {
      pitchingByPlayer.set(r.player_id, {
        games: r.games,
        ip: Number(r.ip),
        era: Number(r.era),
        whip: Number(r.whip),
        k9: Number(r.k9),
      });
    }
    for (const r of rows ?? []) {
      const batting = battingByPlayer.get(r.id);
      const pitching = pitchingByPlayer.get(r.id);
      playersById.set(r.id, {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        grade: r.grade,
        positions: r.positions ?? [],
        jersey: r.player_number,
        schoolName: r.school_name,
        profileSlug: r.profile_slug,
        bats: r.bats,
        throws: r.throws,
        best60yd: r.best_60yd != null ? Number(r.best_60yd) : null,
        bestEV: r.best_ev != null ? Number(r.best_ev) : null,
        bestVelo: r.best_velo != null ? Number(r.best_velo) : null,
        bestField: r.best_field != null ? Number(r.best_field) : null,
        bestBP: r.best_bp != null ? Number(r.best_bp) : null,
        games: batting?.games ?? null,
        ba: batting?.ba ?? null,
        ops: batting?.ops ?? null,
        hr: batting?.hr ?? null,
        pitchingGames: pitching?.games ?? null,
        ip: pitching?.ip ?? null,
        era: pitching?.era ?? null,
        whip: pitching?.whip ?? null,
        k9: pitching?.k9 ?? null,
      });
    }
  }

  return {
    list: {
      id: listRow.id,
      name: listRow.name,
      color: listRow.color,
      emoji: listRow.emoji,
      description: listRow.description,
      playerCount: (members ?? []).length,
      createdAt: listRow.created_at,
    },
    players: (members ?? [])
      .map((m) => {
        const p = playersById.get(m.player_id);
        if (!p) return null;
        return { ...p, notes: m.notes, addedAt: m.added_at };
      })
      .filter((x): x is PlayerSearchResult & { notes: string | null; addedAt: string } => x !== null),
  };
}

export async function fetchPlayerListMembership(
  recruiterId: string,
  playerId: string,
): Promise<string[]> {
  // Return array of list IDs the player is saved to.
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("recruiter_list_players")
    .select("list_id, recruiter_lists!inner(recruiter_id)")
    .eq("player_id", playerId)
    .eq("recruiter_lists.recruiter_id", recruiterId);
  return (data ?? []).map((r) => r.list_id);
}

// ── Saved searches ───────────────────────────────────────────────

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  alertEmail: boolean;
  lastRunAt: string | null;
  lastResultCount: number | null;
  lastRunPlayerIds: string[];
  lastViewedAt: string | null;
  createdAt: string;
}

export async function fetchSavedSearches(
  recruiterId: string,
): Promise<SavedSearch[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recruiter_saved_searches")
    .select(
      "id, name, filters, alert_email, last_run_at, last_result_count, last_run_player_ids, last_viewed_at, created_at",
    )
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    filters: r.filters as SearchFilters,
    alertEmail: r.alert_email,
    lastRunAt: r.last_run_at,
    lastResultCount: r.last_result_count,
    lastRunPlayerIds: (r.last_run_player_ids as string[] | null) ?? [],
    lastViewedAt: r.last_viewed_at,
    createdAt: r.created_at,
  }));
}

// ── Saved-search diffs ───────────────────────────────────────────

export interface SavedSearchDiff {
  searchId: string;
  currentPlayerIds: string[];
  newPlayerIds: string[]; // matches this run but not in baseline
  droppedPlayerIds: string[]; // in baseline but not this run
  total: number;
}

/**
 * For each saved search belonging to this recruiter, re-run the
 * underlying query and diff it against the stored baseline
 * (last_run_player_ids). Returns the new-match counts so the UI can
 * show "3 new since you last checked" badges.
 *
 * Design notes:
 *   - We ignore the `limit` on saved searches when diffing so the
 *     baseline is a true set, not a paginated slice.
 *   - This runs on the server every time /scout/searches renders.
 *     At pilot scale (recruiters with <20 saved searches, <10k players
 *     in the universe) that's cheap — well under 100ms total. If it
 *     becomes a hot path, move it into a single-query JOIN.
 *   - We do NOT update last_run_player_ids here. That happens in
 *     markSavedSearchViewed (called when the recruiter actually
 *     opens the search, not on every peek at the list).
 */
export async function computeSavedSearchDiffs(
  searches: SavedSearch[],
): Promise<SavedSearchDiff[]> {
  // Run all searches in parallel. Each uses searchPlayers without a
  // limit cap so we get the complete match set.
  const results = await Promise.all(
    searches.map(async (s) => {
      const { players } = await searchPlayers({
        ...s.filters,
        limit: 500, // safe upper bound for v1 universe
        offset: 0,
      });
      const currentIds = players.map((p) => p.id);
      const baseline = new Set(s.lastRunPlayerIds);
      const currentSet = new Set(currentIds);
      const newIds = currentIds.filter((id) => !baseline.has(id));
      const droppedIds = Array.from(baseline).filter((id) => !currentSet.has(id));
      return {
        searchId: s.id,
        currentPlayerIds: currentIds,
        newPlayerIds: newIds,
        droppedPlayerIds: droppedIds,
        total: currentIds.length,
      };
    }),
  );
  return results;
}

/**
 * Rollup across all of a recruiter's saved searches — powers the
 * `/scout` home page ribbon ("3 new matches across 2 saved searches").
 */
export async function fetchSavedSearchSummary(
  recruiterId: string,
): Promise<{ totalNew: number; searchesWithNew: number }> {
  const searches = await fetchSavedSearches(recruiterId);
  if (searches.length === 0) return { totalNew: 0, searchesWithNew: 0 };
  const diffs = await computeSavedSearchDiffs(searches);
  // Dedupe player IDs across searches — if a player matches 3 saved
  // searches they shouldn't be counted 3 times in the ribbon.
  const allNew = new Set<string>();
  let searchesWithNew = 0;
  for (const d of diffs) {
    if (d.newPlayerIds.length > 0) searchesWithNew++;
    for (const id of d.newPlayerIds) allNew.add(id);
  }
  return {
    totalNew: allNew.size,
    searchesWithNew,
  };
}

/**
 * Mark a saved search as "just viewed" by the recruiter. Updates the
 * baseline snapshot so next time we compute the diff, current matches
 * count as the new baseline. Called from the search-results page
 * after rendering.
 */
export async function markSavedSearchViewed(
  searchId: string,
  currentPlayerIds: string[],
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  await supabase
    .from("recruiter_saved_searches")
    .update({
      last_run_at: now,
      last_viewed_at: now,
      last_result_count: currentPlayerIds.length,
      last_run_player_ids: currentPlayerIds,
    })
    .eq("id", searchId);
}

// ── Views ────────────────────────────────────────────────────────

/**
 * Log that the current recruiter viewed this player. Idempotent-ish —
 * we always insert (to track repeat views), but the caller should only
 * fire once per page load.
 */
export async function logRecruiterView(
  recruiterId: string,
  playerId: string,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase
    .from("recruiter_views")
    .insert({ recruiter_id: recruiterId, player_id: playerId });
}

/**
 * Fetch recent view history for the current recruiter.
 */
export async function fetchRecentViews(
  recruiterId: string,
  limit = 20,
): Promise<Array<{ playerId: string; firstName: string; lastName: string; profileSlug: string; viewedAt: string }>> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("recruiter_views")
    .select("player_id, viewed_at, players:player_id(first_name, last_name, profile_slug)")
    .eq("recruiter_id", recruiterId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  // Dedupe by player_id keeping the most recent
  const seen = new Set<string>();
  const out: Array<{ playerId: string; firstName: string; lastName: string; profileSlug: string; viewedAt: string }> = [];
  for (const r of data) {
    if (seen.has(r.player_id)) continue;
    seen.add(r.player_id);
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    if (!p) continue;
    out.push({
      playerId: r.player_id,
      firstName: (p as { first_name: string }).first_name,
      lastName: (p as { last_name: string }).last_name,
      profileSlug: (p as { profile_slug: string }).profile_slug,
      viewedAt: r.viewed_at,
    });
  }
  return out;
}

/**
 * Aggregate view stats for a player — powers the public profile's
 * "N college coaches viewed this profile in 30d" card without leaking
 * recruiter identities.
 */
export async function fetchPlayerViewStats(
  playerId: string,
): Promise<{ viewers30d: number; views30d: number; viewers7d: number } | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("player_recruiter_view_stats", {
    _player_id: playerId,
  });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    viewers30d: row.viewers_30d ?? 0,
    views30d: row.views_30d ?? 0,
    viewers7d: row.viewers_7d ?? 0,
  };
}
