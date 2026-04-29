"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";

/**
 * Coach-scoped search action — used by the top-bar palette to find
 * players, games, and practices on the coach's own program.
 *
 * Read-only. No mutation, no demo guard needed (server-side auth is
 * the gate; a demo prospect calling this with no coach context just
 * gets an empty array).
 */

export interface SearchResult {
  id: string;
  kind: "player" | "game" | "practice";
  label: string;
  sub: string;
  href: string;
}

const MAX = 8;

/**
 * Live search across players, games, and practices for the active coach.
 * Empty query returns []. Match is case-insensitive substring.
 *
 * Performance: three small parallel queries with .ilike + .limit. For
 * a HS varsity program this is comfortably under 50ms.
 */
export async function searchProgramAction(
  rawQuery: string,
): Promise<{ results: SearchResult[]; error: string | null }> {
  const q = rawQuery.trim();
  if (!q) return { results: [], error: null };
  if (q.length > 60) return { results: [], error: null }; // ignore garbage input

  const coach = await getCurrentCoach();
  if (!coach) return { results: [], error: null };

  const supabase = createSupabaseServerClient();
  const ilike = `%${q.replace(/[%_]/g, "")}%`; // strip wildcards before interpolating

  const [playersRes, gamesRes, practicesRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, player_number, positions, profile_slug, grade")
      .eq("program_id", coach.program_id)
      .or(
        `first_name.ilike.${ilike},last_name.ilike.${ilike}`,
      )
      .limit(MAX),
    supabase
      .from("games")
      .select("id, opponent, name, game_date, location, team_level")
      .eq("program_id", coach.program_id)
      .or(`opponent.ilike.${ilike},name.ilike.${ilike},location.ilike.${ilike}`)
      .order("game_date", { ascending: false })
      .limit(MAX),
    supabase
      .from("practice_plans")
      .select("id, title, practice_date, team_level")
      .eq("program_id", coach.program_id)
      .ilike("title", ilike)
      .order("practice_date", { ascending: false })
      .limit(MAX),
  ]);

  const results: SearchResult[] = [];

  for (const p of playersRes.data ?? []) {
    results.push({
      id: `pl-${p.id}`,
      kind: "player",
      label: `${p.first_name} ${p.last_name}`,
      sub: [
        p.player_number ? `#${p.player_number}` : null,
        (p.positions ?? []).join("/"),
        gradeShort(p.grade),
      ]
        .filter(Boolean)
        .join(" · "),
      href: p.profile_slug ? `/p/${p.profile_slug}` : `/app/roster`,
    });
  }

  for (const g of gamesRes.data ?? []) {
    const dateLabel = g.game_date
      ? new Date(g.game_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
    results.push({
      id: `g-${g.id}`,
      kind: "game",
      label: g.opponent ? `vs ${g.opponent}` : (g.name ?? "Game"),
      sub: [dateLabel, g.team_level, g.location].filter(Boolean).join(" · "),
      href: `/app/games/${g.id}`,
    });
  }

  for (const pr of practicesRes.data ?? []) {
    const dateLabel = pr.practice_date
      ? new Date(pr.practice_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
    results.push({
      id: `pr-${pr.id}`,
      kind: "practice",
      label: pr.title ?? "Practice",
      sub: [dateLabel, pr.team_level].filter(Boolean).join(" · "),
      href: `/app/practice?plan=${pr.id}`,
    });
  }

  // Truncate to 8 total. Bias toward player matches (they're what
  // coaches search for most) by sorting them first.
  const ordered = [
    ...results.filter((r) => r.kind === "player"),
    ...results.filter((r) => r.kind === "game"),
    ...results.filter((r) => r.kind === "practice"),
  ].slice(0, MAX);

  return { results: ordered, error: null };
}

function gradeShort(grade: number | null): string {
  switch (grade) {
    case 9: return "Fr";
    case 10: return "So";
    case 11: return "Jr";
    case 12: return "Sr";
    default: return "";
  }
}
