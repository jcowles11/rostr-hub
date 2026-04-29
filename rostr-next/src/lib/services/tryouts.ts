import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Tryouts service — reads from the tryouts module tables introduced in
 * migration 20260315000008_tryouts.sql. If the migration hasn't been
 * applied yet (tables missing), every query falls back to empty shape
 * so the UI can render a "no tryouts yet" empty state instead of erroring.
 */

export type TryoutStatus = "scheduled" | "live" | "complete";

export interface Tryout {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: TryoutStatus;
  varsityTarget: number | null;
  jvTarget: number | null;
  notes: string | null;
  createdAt: string;
}

export interface TryoutStation {
  id: string;
  name: string;
  shortCode: string;
  unit: string | null;
  scoreType: "lower_better" | "higher_better" | "rating";
  minValue: number | null;
  maxValue: number | null;
  assignedCoachId: string | null;
  assignedCoachName: string | null;
  status: "active" | "paused";
  sortOrder: number;
  progress: number;
  total: number;
}

/**
 * Verdict model (post-migration 000009):
 *   - "cut"      → player is cut
 *   - "bubble"   → undecided (same as null)
 *   - "lock"     → locked on the top team
 *   - any other  → assigned to that level by name (e.g. "Varsity",
 *                  "Sophomore") matched case-insensitively against
 *                  programs.levels.
 */
export type Verdict = string; // "cut" | "bubble" | "lock" | team-name

export interface TryoutAttendee {
  playerId: string;
  attended: boolean;
  verdict: Verdict | null;
}

export interface TryoutScore {
  id: string;
  stationId: string;
  playerId: string;
  value: number;
  note: string | null;
  flag: "attention" | "standout" | null;
  scoredAt: string;
  scoredBy: string | null;
  scoredByName: string | null;
}

// ── List ────────────────────────────────────────────────────────

export async function fetchTryouts(programId: string): Promise<Tryout[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tryouts")
    .select("id, name, start_date, end_date, status, varsity_target, jv_target, notes, created_at")
    .eq("program_id", programId)
    .order("start_date", { ascending: false });

  if (error) {
    // Common case: migration 000008 not applied → 42P01 undefined_table.
    if (error.code === "42P01" || /tryouts.*does not exist/i.test(error.message)) {
      return [];
    }
    console.error("[tryouts] fetchTryouts:", error.message);
    return [];
  }
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    status: (t.status ?? "scheduled") as TryoutStatus,
    varsityTarget: t.varsity_target,
    jvTarget: t.jv_target,
    notes: t.notes,
    createdAt: t.created_at,
  }));
}

// ── Detail ──────────────────────────────────────────────────────

export interface TryoutDetail {
  tryout: Tryout | null;
  stations: TryoutStation[];
  attendees: TryoutAttendee[];
  scores: TryoutScore[];
  migrationMissing?: boolean;
}

export async function fetchTryoutDetail(tryoutId: string): Promise<TryoutDetail> {
  const supabase = createSupabaseServerClient();

  const tryoutRes = await supabase
    .from("tryouts")
    .select(
      "id, name, start_date, end_date, status, varsity_target, jv_target, notes, created_at",
    )
    .eq("id", tryoutId)
    .maybeSingle();

  if (tryoutRes.error) {
    if (
      tryoutRes.error.code === "42P01" ||
      /tryouts.*does not exist/i.test(tryoutRes.error.message)
    ) {
      return {
        tryout: null,
        stations: [],
        attendees: [],
        scores: [],
        migrationMissing: true,
      };
    }
    return { tryout: null, stations: [], attendees: [], scores: [] };
  }

  if (!tryoutRes.data) {
    return { tryout: null, stations: [], attendees: [], scores: [] };
  }

  const t = tryoutRes.data;
  const tryout: Tryout = {
    id: t.id,
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    status: (t.status ?? "scheduled") as TryoutStatus,
    varsityTarget: t.varsity_target,
    jvTarget: t.jv_target,
    notes: t.notes,
    createdAt: t.created_at,
  };

  const [stationsRes, attendeesRes, scoresRes] = await Promise.all([
    supabase
      .from("tryout_stations")
      .select(
        "id, name, short_code, unit, score_type, min_value, max_value, assigned_coach_id, status, sort_order, coaches:assigned_coach_id(full_name)",
      )
      .eq("tryout_id", tryoutId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("tryout_attendees")
      .select("player_id, attended, verdict")
      .eq("tryout_id", tryoutId),
    supabase
      .from("tryout_scores")
      .select(
        "id, station_id, player_id, value, note, flag, created_at, scored_by, coaches:scored_by(full_name)",
      )
      .eq("tryout_id", tryoutId)
      .order("created_at", { ascending: false }),
  ]);

  const scoreRows = scoresRes.data ?? [];
  const progressByStation = new Map<string, number>();
  for (const s of scoreRows) {
    progressByStation.set(s.station_id, (progressByStation.get(s.station_id) ?? 0) + 1);
  }
  const totalAttendees = (attendeesRes.data ?? []).filter((a) => a.attended).length;

  const stations: TryoutStation[] = (stationsRes.data ?? []).map((s) => {
    const coach = Array.isArray(s.coaches) ? s.coaches[0] : s.coaches;
    return {
      id: s.id,
      name: s.name,
      shortCode: s.short_code,
      unit: s.unit,
      scoreType: s.score_type as TryoutStation["scoreType"],
      minValue: s.min_value,
      maxValue: s.max_value,
      assignedCoachId: s.assigned_coach_id,
      assignedCoachName: coach?.full_name ?? null,
      status: s.status as TryoutStation["status"],
      sortOrder: s.sort_order,
      progress: progressByStation.get(s.id) ?? 0,
      total: totalAttendees,
    };
  });

  const attendees: TryoutAttendee[] = (attendeesRes.data ?? []).map((a) => ({
    playerId: a.player_id,
    attended: a.attended,
    verdict: (a.verdict ?? null) as Verdict | null,
  }));

  const scores: TryoutScore[] = scoreRows.map((s) => {
    const coach = Array.isArray(s.coaches) ? s.coaches[0] : s.coaches;
    return {
      id: s.id,
      stationId: s.station_id,
      playerId: s.player_id,
      value: Number(s.value),
      note: s.note,
      flag: (s.flag ?? null) as TryoutScore["flag"],
      scoredAt: s.created_at,
      scoredBy: s.scored_by,
      scoredByName: coach?.full_name ?? null,
    };
  });

  return { tryout, stations, attendees, scores };
}

// ── Public profile: best measurables ────────────────────────────

export interface PlayerMeasurable {
  shortCode: string;
  stationName: string;
  unit: string | null;
  bestValue: number;
  scoreType: "lower_better" | "higher_better" | "rating";
  latestAt: string | null;
  verifiedByCoachName: string | null;
}

export async function fetchPlayerMeasurables(
  playerId: string,
): Promise<PlayerMeasurable[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_best_measurables")
    .select(
      "short_code, station_name, unit, best_value, score_type, latest_at, verified_by_coach_id, coaches:verified_by_coach_id(full_name)",
    )
    .eq("player_id", playerId);

  if (error) {
    if (
      error.code === "42P01" ||
      /player_best_measurables.*does not exist/i.test(error.message)
    ) {
      return [];
    }
    console.error("[tryouts] fetchPlayerMeasurables:", error.message);
    return [];
  }

  return (data ?? []).map((r) => {
    const coach = Array.isArray(r.coaches) ? r.coaches[0] : r.coaches;
    return {
      shortCode: r.short_code,
      stationName: r.station_name,
      unit: r.unit,
      bestValue: Number(r.best_value),
      scoreType: r.score_type as PlayerMeasurable["scoreType"],
      latestAt: r.latest_at,
      verifiedByCoachName: coach?.full_name ?? null,
    };
  });
}

// ── Station-specific helpers (used by mobile scoring page) ──────

export interface StationScoringContext {
  tryout: Tryout;
  station: TryoutStation;
  attendees: Array<{
    playerId: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    positions: string[];
    currentScore: number | null;
    currentFlag: "attention" | "standout" | null;
    currentNote: string | null;
  }>;
  migrationMissing?: boolean;
}

export async function fetchStationScoringContext(
  tryoutId: string,
  stationId: string,
): Promise<StationScoringContext | null> {
  const supabase = createSupabaseServerClient();

  const tryoutRes = await supabase
    .from("tryouts")
    .select("id, name, start_date, end_date, status, varsity_target, jv_target, notes, created_at, program_id")
    .eq("id", tryoutId)
    .maybeSingle();
  if (tryoutRes.error) {
    if (
      tryoutRes.error.code === "42P01" ||
      /tryouts.*does not exist/i.test(tryoutRes.error.message)
    ) {
      return { migrationMissing: true } as unknown as StationScoringContext;
    }
    return null;
  }
  if (!tryoutRes.data) return null;
  const t = tryoutRes.data;

  const stationRes = await supabase
    .from("tryout_stations")
    .select(
      "id, name, short_code, unit, score_type, min_value, max_value, assigned_coach_id, status, sort_order",
    )
    .eq("id", stationId)
    .maybeSingle();
  if (stationRes.error || !stationRes.data) return null;
  const s = stationRes.data;

  const [attendeesRes, scoresRes] = await Promise.all([
    supabase
      .from("tryout_attendees")
      .select("player_id, attended, players:player_id(first_name, last_name, player_number, positions)")
      .eq("tryout_id", tryoutId)
      .eq("attended", true),
    supabase
      .from("tryout_scores")
      .select("player_id, value, flag, note")
      .eq("tryout_id", tryoutId)
      .eq("station_id", stationId),
  ]);

  const scoreMap = new Map<
    string,
    { value: number; flag: "attention" | "standout" | null; note: string | null }
  >();
  for (const sc of scoresRes.data ?? []) {
    scoreMap.set(sc.player_id, {
      value: Number(sc.value),
      flag: (sc.flag ?? null) as "attention" | "standout" | null,
      note: sc.note,
    });
  }

  const attendees = (attendeesRes.data ?? [])
    .map((a) => {
      const pl = Array.isArray(a.players) ? a.players[0] : a.players;
      if (!pl) return null;
      const current = scoreMap.get(a.player_id);
      return {
        playerId: a.player_id,
        firstName: (pl as { first_name: string }).first_name,
        lastName: (pl as { last_name: string }).last_name,
        jerseyNumber: (pl as { player_number: number | null }).player_number ?? null,
        positions: ((pl as { positions?: string[] }).positions ?? []) as string[],
        currentScore: current?.value ?? null,
        currentFlag: current?.flag ?? null,
        currentNote: current?.note ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return {
    tryout: {
      id: t.id,
      name: t.name,
      startDate: t.start_date,
      endDate: t.end_date,
      status: (t.status ?? "scheduled") as TryoutStatus,
      varsityTarget: t.varsity_target,
      jvTarget: t.jv_target,
      notes: t.notes,
      createdAt: t.created_at,
    },
    station: {
      id: s.id,
      name: s.name,
      shortCode: s.short_code,
      unit: s.unit,
      scoreType: s.score_type as TryoutStation["scoreType"],
      minValue: s.min_value,
      maxValue: s.max_value,
      assignedCoachId: s.assigned_coach_id,
      assignedCoachName: null,
      status: s.status as TryoutStation["status"],
      sortOrder: s.sort_order,
      progress: scoresRes.data?.length ?? 0,
      total: attendees.length,
    },
    attendees,
  };
}
