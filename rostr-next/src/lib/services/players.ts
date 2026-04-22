import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AvatarColor } from "@/components/atoms/avatar";
import type { RosterLevel, AvailabilityStatus, ProfileStatus } from "@/lib/mock-data";
import { avatarColorFromSeed } from "@/components/atoms/avatar";

/**
 * Player service — reads from the existing Supabase schema
 * (players + roster_assignments + program_assignments).
 *
 * Output shape matches the Vite app's PlayerListItem conceptually but is
 * adapted to the MockPlayer shape used by rostr-next's UI so existing
 * components can render real data without modification.
 */

export interface RealPlayer {
  id: string;
  jerseyNumber: number;
  firstName: string;
  lastName: string;
  handle: string;
  initials: string;
  avatarColor: AvatarColor;
  classYear: string;
  classYearShort: string;
  gradYear: number;
  positions: string[];
  level: RosterLevel;
  ba?: string;
  era?: string;
  availabilityStatus: AvailabilityStatus;
  availabilityNote?: string;
  profileStatus: ProfileStatus;
}

// ── Helpers ────────────────────────────────────────────────────

function initialsOf(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  return ((f[0] ?? "?") + (l[0] ?? "?")).toUpperCase();
}

function levelFromAssignment(assignment: string | null | undefined): RosterLevel {
  const a = (assignment ?? "").toLowerCase();
  if (a === "varsity") return "V";
  if (a === "jv") return "JV";
  if (a === "freshman" || a === "frosh") return "F";
  // Default to varsity for anyone without a roster assignment.
  return "V";
}

function gradYearToClassYear(grade: number | null | undefined): {
  gradYear: number;
  classYear: string;
  classYearShort: string;
} {
  // Grade → class year heuristic. US HS: Fr=9, So=10, Jr=11, Sr=12.
  // "Current" class year is this calendar year + (12 - grade).
  const nowYear = new Date().getFullYear();
  const g = grade ?? 9;
  const gradYear = nowYear + Math.max(0, 12 - g);
  const shortMap: Record<number, string> = { 9: "Fr", 10: "So", 11: "Jr", 12: "Sr" };
  const short = shortMap[g] ?? "Fr";
  const yearShort = `'${String(gradYear).slice(-2)}`;
  return {
    gradYear,
    classYear: `${yearShort} ${short}`,
    classYearShort: short,
  };
}

// ── Queries ────────────────────────────────────────────────────

export async function fetchRoster(programId: string): Promise<RealPlayer[]> {
  const supabase = createSupabaseServerClient();

  const [playersRes, assignmentsRes] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, first_name, last_name, grade, positions, player_number, profile_slug, profile_public",
      )
      .eq("program_id", programId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("roster_assignments")
      .select("player_id, assignment")
      .eq("program_id", programId),
  ]);

  if (playersRes.error) {
    console.error("[players] fetchRoster error:", playersRes.error.message);
    return [];
  }

  const assignMap = new Map<string, string>();
  for (const a of assignmentsRes.data ?? []) {
    assignMap.set(a.player_id, a.assignment);
  }

  return (playersRes.data ?? []).map((p) => {
    const { gradYear, classYear, classYearShort } = gradYearToClassYear(p.grade);
    return {
      id: p.id,
      jerseyNumber: p.player_number ?? 0,
      firstName: p.first_name,
      lastName: p.last_name,
      handle: p.profile_slug ?? p.id,
      initials: initialsOf(p.first_name, p.last_name),
      avatarColor: avatarColorFromSeed(p.id),
      classYear,
      classYearShort,
      gradYear,
      positions: p.positions ?? [],
      level: levelFromAssignment(assignMap.get(p.id)),
      availabilityStatus: "ok" as AvailabilityStatus,
      profileStatus: (p.profile_public ? "linked" : "unlinked") as ProfileStatus,
    };
  });
}

export async function fetchPlayerBySlug(slug: string): Promise<RealPlayer | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, grade, positions, player_number, profile_slug, profile_public, program_id",
    )
    .eq("profile_slug", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { gradYear, classYear, classYearShort } = gradYearToClassYear(data.grade);

  const { data: assign } = await supabase
    .from("roster_assignments")
    .select("assignment")
    .eq("player_id", data.id)
    .limit(1)
    .maybeSingle();

  return {
    id: data.id,
    jerseyNumber: data.player_number ?? 0,
    firstName: data.first_name,
    lastName: data.last_name,
    handle: data.profile_slug ?? data.id,
    initials: initialsOf(data.first_name, data.last_name),
    avatarColor: avatarColorFromSeed(data.id),
    classYear,
    classYearShort,
    gradYear,
    positions: data.positions ?? [],
    level: levelFromAssignment(assign?.assignment),
    availabilityStatus: "ok",
    profileStatus: (data.profile_public ? "linked" : "unlinked") as ProfileStatus,
  };
}

export async function fetchPlayerCount(programId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId);
  return count ?? 0;
}
