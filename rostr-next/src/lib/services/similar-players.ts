import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Similar-players service — powers the "players like this one"
 * section on the recruiter profile overlay.
 *
 * Algorithm (v1): deterministic nearest-neighbor on verified
 * measurables. No LLM, no embeddings — a simple Euclidean distance
 * on normalized stats, filtered by class-year proximity + position
 * overlap, ranked ascending by distance.
 *
 * Why not embeddings: for 60 to 10,000 players the cost of comparing
 * a 5-dimensional vector vs. each candidate is ~nothing, and the
 * result is explainable: "matched on 60yd + EV + class year."
 * We'll upgrade to embeddings when the stat surface broadens to
 * include subjective notes + game results.
 */

export interface SimilarPlayer {
  id: string;
  firstName: string;
  lastName: string;
  profileSlug: string;
  grade: number | null;
  classYear: number | null;
  positions: string[];
  schoolName: string | null;
  best60yd: number | null;
  bestEV: number | null;
  bestVelo: number | null;
  bestField: number | null;
  bestBP: number | null;
  similarity: number; // 0–1 (1 = identical)
  matchReasons: string[]; // human-readable explanation
}

/**
 * Find the top N public players most similar to the given target.
 * Returns empty array if the target has no measurables to compare.
 */
export async function findSimilarPlayers(
  targetPlayerId: string,
  limit = 5,
): Promise<SimilarPlayer[]> {
  const supabase = createSupabaseServerClient();

  // Pull the target player's measurable vector + grade + positions
  const { data: target } = await supabase
    .from("player_search")
    .select(
      "id, grade, positions, best_60yd, best_ev, best_velo, best_field, best_bp",
    )
    .eq("id", targetPlayerId)
    .maybeSingle();
  if (!target) return [];

  // Skip similarity if the target has no measurables at all.
  const anyMeasurable =
    target.best_60yd != null ||
    target.best_ev != null ||
    target.best_velo != null ||
    target.best_field != null ||
    target.best_bp != null;
  if (!anyMeasurable) return [];

  // Candidate pool: public players within ±1 grade of the target with
  // at least some position overlap. Keep the pool narrow so we don't
  // pay the cost of scoring 50k rows in memory.
  const gradeFloor = target.grade != null ? target.grade - 1 : null;
  const gradeCeil = target.grade != null ? target.grade + 1 : null;

  let q = supabase
    .from("player_search")
    .select(
      "id, first_name, last_name, profile_slug, grade, positions, school_name, best_60yd, best_ev, best_velo, best_field, best_bp",
    )
    .eq("profile_public", true)
    .neq("id", targetPlayerId);

  if (gradeFloor != null && gradeCeil != null) {
    q = q.gte("grade", gradeFloor).lte("grade", gradeCeil);
  }

  if (target.positions && target.positions.length > 0) {
    q = q.overlaps("positions", target.positions);
  }

  const { data: candidates, error } = await q.limit(200);
  if (error || !candidates) return [];

  // Z-score-ish normalization: compute each stat's range across the
  // candidate pool so distance isn't dominated by "EV is in mph (0-100)
  // vs. field rating (1-5)". We use (max - min) spread.
  const stats = {
    best_60yd: extent(candidates, target, "best_60yd"),
    best_ev: extent(candidates, target, "best_ev"),
    best_velo: extent(candidates, target, "best_velo"),
    best_field: extent(candidates, target, "best_field"),
    best_bp: extent(candidates, target, "best_bp"),
  };

  const scored = candidates.map((c) => {
    // Per-dimension normalized squared difference. Skip dimensions
    // either player doesn't have — we only penalize on overlap.
    const dims: Array<{ key: keyof typeof stats; weight: number; lowerBetter: boolean }> = [
      { key: "best_60yd", weight: 1.0, lowerBetter: true },
      { key: "best_ev", weight: 1.0, lowerBetter: false },
      { key: "best_velo", weight: 0.8, lowerBetter: false },
      { key: "best_field", weight: 0.6, lowerBetter: false },
      { key: "best_bp", weight: 0.6, lowerBetter: false },
    ];

    let sumSq = 0;
    let totalWeight = 0;
    const matchBits: string[] = [];

    for (const d of dims) {
      const ta = (target as Record<string, unknown>)[d.key] as number | null;
      const ca = (c as Record<string, unknown>)[d.key] as number | null;
      const range = stats[d.key];
      if (ta == null || ca == null || range == null || range === 0) continue;
      const diff = Math.abs(ta - ca) / range;
      sumSq += d.weight * diff * diff;
      totalWeight += d.weight;

      // Tight match = within 10% of the range → call it out in the reason list.
      if (diff < 0.1) {
        const label = shortCodeFor(d.key);
        matchBits.push(
          `${label} ${formatValue(Number(ca), d.key)}`,
        );
      }
    }

    // Identical: 0 distance → similarity 1. Fall off smoothly.
    const distance = totalWeight > 0 ? Math.sqrt(sumSq / totalWeight) : 1;
    const similarity = Math.max(0, 1 - distance);

    // Bonus: same grade year → tighter match
    const sameGrade = target.grade === c.grade;
    const sharedPositions = c.positions?.filter((p: string) =>
      (target.positions ?? []).includes(p),
    );
    if (sharedPositions && sharedPositions.length > 0) {
      matchBits.push(`Position · ${sharedPositions.join("/")}`);
    }
    if (sameGrade && c.grade != null) {
      matchBits.push(`Class of ${classYearForGrade(c.grade)}`);
    }

    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      profileSlug: c.profile_slug,
      grade: c.grade,
      classYear: c.grade != null ? classYearForGrade(c.grade) : null,
      positions: c.positions ?? [],
      schoolName: c.school_name,
      best60yd: c.best_60yd != null ? Number(c.best_60yd) : null,
      bestEV: c.best_ev != null ? Number(c.best_ev) : null,
      bestVelo: c.best_velo != null ? Number(c.best_velo) : null,
      bestField: c.best_field != null ? Number(c.best_field) : null,
      bestBP: c.best_bp != null ? Number(c.best_bp) : null,
      similarity,
      matchReasons: matchBits.slice(0, 3),
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  // Only return players with at least some overlap worth mentioning.
  return scored
    .filter((s) => s.similarity > 0.2 && s.matchReasons.length > 0)
    .slice(0, limit);
}

function extent(
  candidates: Array<Record<string, unknown>>,
  target: Record<string, unknown>,
  key: string,
): number | null {
  const vals: number[] = [];
  for (const c of candidates) {
    const v = c[key];
    if (v != null && typeof v !== "undefined") vals.push(Number(v));
  }
  const t = target[key];
  if (t != null) vals.push(Number(t));
  if (vals.length === 0) return null;
  return Math.max(...vals) - Math.min(...vals);
}

function shortCodeFor(key: string): string {
  if (key === "best_60yd") return "60yd";
  if (key === "best_ev") return "EV";
  if (key === "best_velo") return "Velo";
  if (key === "best_field") return "Field";
  if (key === "best_bp") return "BP";
  return key;
}

function formatValue(v: number, key: string): string {
  if (key === "best_60yd") return `${v.toFixed(2)}s`;
  if (key === "best_ev" || key === "best_velo") return `${Math.round(v)}mph`;
  return v.toFixed(1);
}

function classYearForGrade(grade: number): number {
  const nowYear = new Date().getFullYear();
  return nowYear + Math.max(0, 12 - grade);
}
