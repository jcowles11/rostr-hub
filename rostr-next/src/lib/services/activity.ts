import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Activity service — pulls a cross-table chronological feed for the
 * Coach Hub. Merges recent events from the 4 most signal-rich sources:
 *
 *   - tryout_scores          (coach scored a player at a station)
 *   - player_notes           (coach added a note about a player)
 *   - games                  (game scheduled or completed)
 *   - roster_assignments     (player moved between teams / cut)
 *
 * This replaces the hardcoded mock feed on the Hub. If any source is
 * empty, we skip it silently — an empty feed shows the UI's empty state.
 */

export type ActivityKind =
  | "score"
  | "note"
  | "game_scheduled"
  | "game_completed"
  | "roster_change";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  at: string; // ISO timestamp
  /** Short noun-phrase for the icon (1–2 letters). */
  icon: string;
  /** Avatar color — matches AvatarColor tokens. */
  iconColor: "red" | "sky" | "grass" | "amber" | "gold" | "ink" | "dirt";
  /** HTML-ish markup with <b> tags for emphasized names. */
  content: string;
  /** Relative-time sub-label ("2m ago"). */
  meta: string;
}

export async function fetchRecentActivity(
  programId: string,
  limit = 8,
): Promise<ActivityEvent[]> {
  const supabase = createSupabaseServerClient();
  const sinceISO = new Date(Date.now() - 14 * 864e5).toISOString(); // last 2 weeks

  // Run all source queries in parallel — each is a narrow/indexed read.
  const [scoresRes, notesRes, gamesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("tryout_scores")
      .select(
        "id, value, created_at, players:player_id(first_name, last_name, program_id), tryout_stations:station_id(short_code, name, unit), coaches:scored_by(full_name)",
      )
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("player_notes")
      .select(
        "id, content, created_at, players:player_id(first_name, last_name, program_id), coaches:coach_id(full_name)",
      )
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("games")
      .select("id, name, opponent, game_date, team_level, status, our_score, opponent_score, result, completed_at, created_at, coaches:created_by(full_name), completer:completed_by(full_name)")
      .eq("program_id", programId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("roster_assignments")
      .select(
        "id, assignment, updated_at, players:player_id(first_name, last_name, program_id), coaches:assigned_by(full_name)",
      )
      .gte("updated_at", sinceISO)
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);

  const events: ActivityEvent[] = [];

  // tryout_scores — filter client-side to this program via the player join.
  for (const s of scoresRes.data ?? []) {
    const player = Array.isArray(s.players) ? s.players[0] : s.players;
    if (!player || player.program_id !== programId) continue;
    const station = Array.isArray(s.tryout_stations) ? s.tryout_stations[0] : s.tryout_stations;
    const coach = Array.isArray(s.coaches) ? s.coaches[0] : s.coaches;
    events.push({
      id: `score-${s.id}`,
      kind: "score",
      at: s.created_at,
      icon: initialsOf(coach?.full_name),
      iconColor: "red",
      content: `<b>${coach?.full_name ?? "Coach"}</b> scored <b>${player.first_name} ${player.last_name}</b> · ${station?.short_code ?? ""} ${s.value}${station?.unit ?? ""}`,
      meta: formatRelative(s.created_at),
    });
  }

  // player_notes
  for (const n of notesRes.data ?? []) {
    const player = Array.isArray(n.players) ? n.players[0] : n.players;
    if (!player || player.program_id !== programId) continue;
    const coach = Array.isArray(n.coaches) ? n.coaches[0] : n.coaches;
    const snippet = (n.content ?? "").slice(0, 60);
    events.push({
      id: `note-${n.id}`,
      kind: "note",
      at: n.created_at,
      icon: initialsOf(coach?.full_name),
      iconColor: "amber",
      content: `<b>${coach?.full_name ?? "Coach"}</b> noted <b>${player.first_name} ${player.last_name}</b>: ${snippet}${n.content && n.content.length > 60 ? "…" : ""}`,
      meta: formatRelative(n.created_at),
    });
  }

  // games — always in-program (filtered by program_id query)
  for (const g of gamesRes.data ?? []) {
    const creator = Array.isArray(g.coaches) ? g.coaches[0] : g.coaches;
    const completer = Array.isArray(g.completer) ? g.completer[0] : g.completer;
    const dateLabel = new Date(`${g.game_date}T00:00:00`).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" },
    );

    // Emit a "scheduled" entry for the creation
    events.push({
      id: `game-${g.id}`,
      kind: "game_scheduled",
      at: g.created_at,
      icon: initialsOf(creator?.full_name),
      iconColor: "sky",
      content: `<b>${creator?.full_name ?? "Coach"}</b> scheduled <b>${g.team_level ?? "team"}</b> vs <b>${g.opponent ?? g.name}</b> · ${dateLabel}`,
      meta: formatRelative(g.created_at),
    });

    // Also emit a separate "completed" entry when there's a final score.
    // Both show up in the feed; sort+limit below handles chronological merge.
    if (
      g.status === "completed" &&
      g.our_score != null &&
      g.opponent_score != null &&
      g.completed_at
    ) {
      const resultEmoji = g.result === "W" ? "🏆" : g.result === "L" ? "" : "";
      events.push({
        id: `game-final-${g.id}`,
        kind: "game_completed",
        at: g.completed_at,
        icon: initialsOf(completer?.full_name ?? creator?.full_name),
        iconColor: g.result === "W" ? "grass" : g.result === "L" ? "red" : "amber",
        content: `${resultEmoji} <b>${g.team_level ?? "Team"}</b> ${g.result === "W" ? "won" : g.result === "L" ? "lost" : "tied"} ${g.our_score}–${g.opponent_score} vs <b>${g.opponent ?? g.name}</b>`,
        meta: formatRelative(g.completed_at),
      });
    }
  }

  // roster_assignments
  for (const r of assignmentsRes.data ?? []) {
    const player = Array.isArray(r.players) ? r.players[0] : r.players;
    if (!player || player.program_id !== programId) continue;
    const coach = Array.isArray(r.coaches) ? r.coaches[0] : r.coaches;
    const assign = (r.assignment ?? "").toLowerCase();
    const cut = assign === "cut";
    events.push({
      id: `assign-${r.id}`,
      kind: "roster_change",
      at: r.updated_at,
      icon: initialsOf(coach?.full_name),
      iconColor: cut ? "red" : "grass",
      content: cut
        ? `<b>${coach?.full_name ?? "Coach"}</b> cut <b>${player.first_name} ${player.last_name}</b>`
        : `<b>${coach?.full_name ?? "Coach"}</b> moved <b>${player.first_name} ${player.last_name}</b> to <b>${capitalize(assign)}</b>`,
      meta: formatRelative(r.updated_at),
    });
  }

  // Merge + sort + cap
  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  return events.slice(0, limit);
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Spotlight ───────────────────────────────────────────────────

export interface SpotlightPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  positions: string[];
  classYear: string;
  initials: string;
  handle: string;
  reason: string; // "Top 60yd (6.74s)"
  stats: Array<{ label: string; value: string }>;
}

/**
 * fetchSpotlight — picks the player with the strongest recent
 * measurable to feature on the Hub. Prefers tryout standouts; falls
 * back to null when there's no data yet so the UI renders an empty
 * state instead of a fake name.
 */
export async function fetchSpotlight(
  programId: string,
): Promise<SpotlightPlayer | null> {
  const supabase = createSupabaseServerClient();

  // Pull every best measurable for players in this program.
  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, player_number, positions, grade, profile_slug")
    .eq("program_id", programId);
  if (!players || players.length === 0) return null;

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const { data: measurables } = await supabase
    .from("player_best_measurables")
    .select("player_id, short_code, station_name, unit, best_value, score_type, latest_at")
    .in(
      "player_id",
      players.map((p) => p.id),
    );
  if (!measurables || measurables.length === 0) return null;

  // Score each measurable by how extreme it is vs. the group's mean.
  // Bigger absolute z-score = more spotlight-worthy. Lower_better flips sign.
  const byStation = new Map<string, number[]>();
  for (const m of measurables) {
    const arr = byStation.get(m.short_code) ?? [];
    arr.push(Number(m.best_value));
    byStation.set(m.short_code, arr);
  }

  const stats = new Map<string, { mean: number; std: number }>();
  for (const [sc, vals] of Array.from(byStation.entries())) {
    if (vals.length < 2) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std =
      Math.sqrt(
        vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length,
      ) || 1;
    stats.set(sc, { mean, std });
  }

  let best: (typeof measurables)[number] | null = null;
  let bestScore = -Infinity;
  for (const m of measurables) {
    const s = stats.get(m.short_code);
    if (!s) continue;
    const v = Number(m.best_value);
    const z = (v - s.mean) / s.std;
    const score = m.score_type === "lower_better" ? -z : z;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  if (!best) return null;
  const p = playerMap.get(best.player_id);
  if (!p) return null;

  const classYear = gradeToClassYear(p.grade ?? 9);
  return {
    playerId: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    jerseyNumber: p.player_number,
    positions: p.positions ?? [],
    classYear,
    initials: (p.first_name[0] ?? "?") + (p.last_name[0] ?? "?"),
    handle: p.profile_slug ?? p.id,
    reason: `Top ${best.short_code} on the roster · ${formatValue(best)}`,
    stats: measurables
      .filter((m) => m.player_id === best!.player_id)
      .slice(0, 3)
      .map((m) => ({
        label: m.short_code,
        value: formatValue(m),
      })),
  };
}

function formatValue(m: {
  best_value: unknown;
  score_type: string;
  unit: string | null;
}): string {
  const v = Number(m.best_value);
  if (m.score_type === "rating") return v.toFixed(1);
  if (m.unit === "s") return v.toFixed(2) + (m.unit ? m.unit : "");
  const base = v.toFixed(1).replace(/\.0$/, "");
  return m.unit ? `${base} ${m.unit}` : base;
}

function gradeToClassYear(grade: number): string {
  const map: Record<number, string> = {
    9: "Fr",
    10: "So",
    11: "Jr",
    12: "Sr",
  };
  return map[grade] ?? "—";
}
