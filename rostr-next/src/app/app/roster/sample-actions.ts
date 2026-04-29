"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";

/**
 * Seed sample roster — gives a fresh coach a populated team to play
 * around with before importing their real roster. Inserts 15 plausible
 * HS varsity players. Idempotent: skips players whose first+last name
 * already exists on the coach's program.
 *
 * Intent: fix the new-account empty-state cliff. Coach signs up,
 * lands on /app/roster, sees nothing, doesn't know what the product
 * does. With this they click "Try with sample roster" and the rest
 * of the app (schedule, stats, practice planner) immediately has
 * real-looking data to render.
 */
export async function seedSampleRosterAction(): Promise<{
  error: string | null;
  inserted: number;
}> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE, inserted: 0 };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", inserted: 0 };

  const supabase = createSupabaseServerClient();

  // Skip if the program already has any players — sample is for
  // empty rosters only. Coaches who want to wipe + reseed can use
  // Settings → Data → Wipe and re-run.
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("program_id", coach.program_id);
  if ((count ?? 0) > 0) {
    return {
      error: "Roster already has players. Sample only seeds empty rosters.",
      inserted: 0,
    };
  }

  const rows = SAMPLE_ROSTER.map((p) => ({
    program_id: coach.program_id,
    first_name: p.firstName,
    last_name: p.lastName,
    grade: p.grade,
    positions: p.positions,
    bats: p.bats,
    throws: p.throws,
    player_number: p.jersey,
  }));

  const { error, data } = await supabase
    .from("players")
    .insert(rows)
    .select("id");
  if (error) return { error: error.message, inserted: 0 };

  // Auto-assign all sampled players to the coach's first configured
  // level so they show up immediately on the roster page.
  const firstLevel = coach.program_levels?.[0]?.toLowerCase() ?? "varsity";
  if (data && data.length > 0) {
    await supabase.from("roster_assignments").insert(
      data.map((p) => ({
        program_id: coach.program_id,
        player_id: p.id,
        assignment: firstLevel,
        assigned_by: coach.id,
      })),
    );
  }

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, inserted: data?.length ?? 0 };
}

/**
 * 15 plausible HS varsity baseball players. Naming + positions
 * chosen to be unmistakably sample data (no real first+last combos
 * mirror existing demo-mode names). Distribution: 4 P, 1 C, 7 IF,
 * 4 OF — the same shape a real tight roster takes.
 */
const SAMPLE_ROSTER: Array<{
  firstName: string;
  lastName: string;
  grade: number;
  positions: string[];
  bats: "L" | "R" | "S";
  throws: "L" | "R";
  jersey: number;
}> = [
  { firstName: "Sample", lastName: "Adams",      grade: 12, positions: ["CF"],       bats: "R", throws: "R", jersey: 1 },
  { firstName: "Sample", lastName: "Baker",      grade: 11, positions: ["SS"],       bats: "R", throws: "R", jersey: 2 },
  { firstName: "Sample", lastName: "Carter",     grade: 12, positions: ["P", "1B"],  bats: "R", throws: "R", jersey: 3 },
  { firstName: "Sample", lastName: "Diaz",       grade: 11, positions: ["2B", "3B"], bats: "R", throws: "R", jersey: 4 },
  { firstName: "Sample", lastName: "Edwards",    grade: 10, positions: ["C"],        bats: "R", throws: "R", jersey: 5 },
  { firstName: "Sample", lastName: "Foster",     grade: 12, positions: ["RF"],       bats: "L", throws: "L", jersey: 6 },
  { firstName: "Sample", lastName: "Garcia",     grade: 11, positions: ["3B"],       bats: "R", throws: "R", jersey: 7 },
  { firstName: "Sample", lastName: "Harris",     grade: 10, positions: ["P"],        bats: "L", throws: "L", jersey: 8 },
  { firstName: "Sample", lastName: "Iverson",    grade: 11, positions: ["LF"],       bats: "R", throws: "R", jersey: 9 },
  { firstName: "Sample", lastName: "Johnson",    grade: 12, positions: ["P", "DH"],  bats: "R", throws: "R", jersey: 10 },
  { firstName: "Sample", lastName: "Kim",        grade: 11, positions: ["1B"],       bats: "L", throws: "R", jersey: 11 },
  { firstName: "Sample", lastName: "Lopez",      grade: 12, positions: ["3B"],       bats: "R", throws: "R", jersey: 12 },
  { firstName: "Sample", lastName: "Martinez",   grade: 10, positions: ["SS"],       bats: "S", throws: "R", jersey: 13 },
  { firstName: "Sample", lastName: "Nguyen",     grade: 11, positions: ["CF"],       bats: "R", throws: "R", jersey: 14 },
  { firstName: "Sample", lastName: "Olson",      grade: 10, positions: ["P"],        bats: "R", throws: "R", jersey: 15 },
];

/**
 * Counterpart that wipes sample players. Coaches can clear sample data
 * before importing their real roster. Only deletes players whose
 * first_name = "Sample" — won't touch real players.
 */
export async function clearSampleRosterAction(): Promise<{
  error: string | null;
  deleted: number;
}> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE, deleted: 0 };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", deleted: 0 };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .delete()
    .eq("program_id", coach.program_id)
    .eq("first_name", "Sample")
    .select("id");
  if (error) return { error: error.message, deleted: 0 };

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, deleted: data?.length ?? 0 };
}
