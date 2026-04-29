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
  /** Short code for table display (V / JV / Fr) — back-compat. */
  level: RosterLevel;
  /** Full configured level name (e.g. "Varsity", "Sophomore"). */
  levelName: string;
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

function levelFromAssignment(
  assignment: string | null | undefined,
  configuredLevels: string[] = [],
): RosterLevel {
  const a = (assignment ?? "").toLowerCase();
  // Derive a short 1-3 letter display code from the assignment name or the
  // matching configured level. Works for any team name the coach configured.
  if (!a || a === "cut") return "V"; // legacy default
  // If the assignment exactly matches a configured level, use its first 1–2 letters.
  const match = configuredLevels.find((l) => l.toLowerCase() === a);
  if (match) return shortCodeFromName(match) as RosterLevel;
  // Legacy known aliases.
  if (a === "varsity") return "V";
  if (a === "jv" || a === "junior varsity") return "JV";
  if (a === "freshman" || a === "frosh") return "F";
  return shortCodeFromName(a) as RosterLevel;
}

function shortCodeFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "V";
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }
  // Single word: first letter (capitalized). "Sophomore" → "So"? Too ambiguous.
  // Use first 2 letters so "Sophomore" → "SO", "Freshman" → "FR", "Varsity" → "VA".
  return trimmed.slice(0, 2).toUpperCase();
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

export async function fetchRoster(
  programId: string,
  configuredLevels: string[] = ["Varsity", "JV", "Freshman"],
): Promise<RealPlayer[]> {
  const supabase = createSupabaseServerClient();

  // Active roster only — released players are filtered out via the
  // soft-delete column added in migration 000028. If that column
  // doesn't exist on the database yet (migration not applied), we
  // detect the column-missing error and fall back to a SELECT
  // without the filter so pre-migration databases still work.
  type PlayerRow = {
    id: string;
    first_name: string;
    last_name: string;
    grade: number | null;
    positions: string[] | null;
    player_number: number | null;
    profile_slug: string | null;
    profile_public: boolean | null;
  };

  const tryActiveRoster = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, grade, positions, player_number, profile_slug, profile_public, released_at",
    )
    .eq("program_id", programId)
    .is("released_at", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  let playerRows: PlayerRow[] | null = tryActiveRoster.data as PlayerRow[] | null;
  let playersErr = tryActiveRoster.error;

  if (
    playersErr &&
    /column .* released_at .* does not exist/i.test(playersErr.message)
  ) {
    const fallback = await supabase
      .from("players")
      .select(
        "id, first_name, last_name, grade, positions, player_number, profile_slug, profile_public",
      )
      .eq("program_id", programId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    playerRows = fallback.data as PlayerRow[] | null;
    playersErr = fallback.error;
  }

  const assignmentsRes = await supabase
    .from("roster_assignments")
    .select("player_id, assignment")
    .eq("program_id", programId);

  if (playersErr) {
    console.error("[players] fetchRoster error:", playersErr.message);
    return [];
  }

  const assignMap = new Map<string, string>();
  for (const a of assignmentsRes.data ?? []) {
    assignMap.set(a.player_id, a.assignment);
  }

  return (playerRows ?? []).map((p) => {
    const { gradYear, classYear, classYearShort } = gradYearToClassYear(p.grade);
    const assignment = assignMap.get(p.id);
    const level = levelFromAssignment(assignment, configuredLevels);
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
      level,
      levelName: mapEnumToConfiguredName(assignment, configuredLevels),
      availabilityStatus: "ok" as AvailabilityStatus,
      profileStatus: (p.profile_public ? "linked" : "unlinked") as ProfileStatus,
    };
  });
}

function mapEnumToConfiguredName(
  assignment: string | null | undefined,
  configuredLevels: string[],
): string {
  if (!assignment) return "Unassigned";
  const lower = assignment.toLowerCase();
  if (lower === "cut") return "Cut";
  // Primary path: exact case-insensitive match against configured levels.
  const match = configuredLevels.find((l) => l.toLowerCase() === lower);
  if (match) return match;
  // Legacy fallback for pre-refactor rows.
  if (lower === "varsity") return configuredLevels[0] ?? "Varsity";
  if (lower === "jv") return configuredLevels[1] ?? "JV";
  if (lower === "freshman") return configuredLevels[configuredLevels.length - 1] ?? "Freshman";
  return "Unassigned";
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
    levelName: mapEnumToConfiguredName(assign?.assignment, ["Varsity", "JV", "Freshman"]),
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
