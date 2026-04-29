"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import {
  BulkPlayerInput as BulkPlayerSchema,
  CreateNoteInput as CreateNoteSchema,
  CreatePlayerAnnouncementInput as CreatePlayerAnnouncementSchema,
  CreatePlayerInput as CreatePlayerSchema,
  PlayerAvailabilityInput as PlayerAvailabilitySchema,
  UpdatePlayerInput as UpdatePlayerSchema,
  UpdatePlayerProfileMediaInput as UpdatePlayerProfileMediaSchema,
  firstZodError,
} from "@/lib/validation/schemas";

// Public input types — re-exported so client callers don't import from
// /lib/validation directly. Backed by Zod schemas (see imports above).
export type CreatePlayerInput = import("@/lib/validation/schemas").CreatePlayerInput;
export type UpdatePlayerInput = import("@/lib/validation/schemas").UpdatePlayerInput;
export type BulkPlayer = import("@/lib/validation/schemas").BulkPlayerInput;
export type UpdatePlayerProfileMediaInput = import("@/lib/validation/schemas").UpdatePlayerProfileMediaInput;
export type CreatePlayerAnnouncementInput = import("@/lib/validation/schemas").CreatePlayerAnnouncementInput;

/**
 * createPlayerAction — inserts a player row on the coach's program.
 * Returns the new player id on success, or an error string.
 *
 * Input is validated by Zod (see CreatePlayerSchema). Bounds enforced:
 * names trimmed + length-capped, grade 9-12, jersey 0-999, bats∈{L,R,S},
 * throws∈{L,R}, positions deduped + uppercased.
 */
export async function createPlayerAction(
  input: CreatePlayerInput,
): Promise<{ error: string | null; playerId?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = CreatePlayerSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const safe = parsed.data;

  const coach = await getCurrentCoach();
  if (!coach) {
    return { error: "You need to set up your program first." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .insert({
      program_id: coach.program_id,
      first_name: safe.firstName,
      last_name: safe.lastName,
      grade: safe.grade,
      positions: safe.positions,
      bats: safe.bats,
      throws: safe.throws,
      player_number: safe.playerNumber,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Couldn't create the player." };
  }

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, playerId: data.id };
}

export async function updatePlayerAction(
  input: UpdatePlayerInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = UpdatePlayerSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const safe = parsed.data;
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("players")
    .update({
      first_name: safe.firstName,
      last_name: safe.lastName,
      grade: safe.grade,
      positions: safe.positions,
      bats: safe.bats,
      throws: safe.throws,
      player_number: safe.playerNumber,
    })
    .eq("id", safe.id)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

/**
 * setPlayerAvailabilityAction — update a player's availability_status.
 * Schema in the live Supabase stores status on the players row directly.
 */
export async function setPlayerAvailabilityAction(
  playerId: string,
  status: "ok" | "questionable" | "out",
  note?: string | null,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = PlayerAvailabilitySchema.safeParse({ playerId, status, note });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = {
    availability_status: parsed.data.status,
    availability_note: parsed.data.note,
  };
  const { error } = await supabase
    .from("players")
    .update(patch)
    .eq("id", parsed.data.playerId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

// ── Player notes ──────────────────────────────────────────────────

export interface PlayerNote {
  id: string;
  content: string;
  createdAt: string;
  coachName?: string;
}

export async function fetchPlayerNotesAction(
  playerId: string,
): Promise<{ notes: PlayerNote[]; error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { notes: [], error: null };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_notes")
    .select("id, content, created_at, coach_id, coaches(full_name)")
    .eq("player_id", playerId)
    .eq("program_id", coach.program_id)
    .order("created_at", { ascending: false });
  if (error) return { notes: [], error: error.message };
  // Supabase's generated types infer the FK join as an array when the
  // relationship isn't constrained to a single row — normalize both shapes.
  const rows = (data ?? []) as Array<{
    id: string;
    content: string;
    created_at: string;
    coaches?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
  }>;
  return {
    notes: rows.map((n) => {
      const coach = Array.isArray(n.coaches) ? n.coaches[0] : n.coaches;
      return {
        id: n.id,
        content: n.content,
        createdAt: n.created_at,
        coachName: coach?.full_name ?? undefined,
      };
    }),
    error: null,
  };
}

export async function createNoteAction(
  playerId: string,
  content: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = CreateNoteSchema.safeParse({ playerId, content });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("player_notes").insert({
    program_id: coach.program_id,
    player_id: parsed.data.playerId,
    coach_id: coach.id,
    content: parsed.data.content,
    flag: null,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  return { error: null };
}

export async function deleteNoteAction(noteId: string): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("player_notes")
    .delete()
    .eq("id", noteId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  return { error: null };
}

/**
 * deletePlayerAction — soft delete by default. Stamps `released_at`
 * + the coach who released them. The player disappears from the
 * active roster but their stat history, public profile, and
 * recruiter views all stay intact.
 *
 * If a coach genuinely needs to hard-delete (e.g. a player added in
 * error), use `hardDeletePlayerAction` — that path requires explicit
 * confirmation and the player must already be soft-released.
 */
export async function deletePlayerAction(
  playerId: string,
  releaseNote?: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Try the soft-delete path first.
  const { error: softErr } = await supabase
    .from("players")
    .update({
      released_at: new Date().toISOString(),
      released_by: coach.id,
      release_note: releaseNote?.trim() || null,
    })
    .eq("id", playerId)
    .eq("program_id", coach.program_id);

  // Migration 000028 not applied → released_at column missing → fall
  // back to legacy hard delete so the action still does *something*.
  // Pre-migration teams keep the old behavior; post-migration teams
  // get safer soft delete automatically.
  if (
    softErr &&
    /column .* (released_at|released_by|release_note) .* does not exist/i.test(softErr.message)
  ) {
    const { error: hardErr } = await supabase
      .from("players")
      .delete()
      .eq("id", playerId)
      .eq("program_id", coach.program_id);
    if (hardErr) return { error: hardErr.message };
    revalidatePath("/app/roster");
    revalidatePath("/app");
    return { error: null };
  }
  if (softErr) return { error: softErr.message };

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

/**
 * reinstatePlayerAction — undo a release. Coach changed their mind
 * within the same season, or released the wrong kid by accident.
 * Clears `released_at` and the player reappears on the roster with
 * all their stat history intact.
 */
export async function reinstatePlayerAction(
  playerId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("players")
    .update({ released_at: null, released_by: null, release_note: null })
    .eq("id", playerId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

/**
 * hardDeletePlayerAction — permanent. Use only when the player was
 * added in error and there's no historical data to preserve. Requires
 * the player to already be soft-released so accidental clicks can't
 * skip past the recoverable state.
 */
export async function hardDeletePlayerAction(
  playerId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Verify the player is already released, so this can't be an
  // accidental skip past soft-delete.
  const { data: existing } = await supabase
    .from("players")
    .select("released_at")
    .eq("id", playerId)
    .eq("program_id", coach.program_id)
    .maybeSingle();
  if (!existing) return { error: "Player not found." };
  // Skip the safety check if released_at column doesn't exist (pre-
  // migration); on those databases hard delete IS the only option.
  if (existing.released_at !== undefined && existing.released_at === null) {
    return {
      error: "Release the player first, then permanently delete if needed.",
    };
  }

  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

/**
 * bulkSetPlayerLevelAction — apply a level to many players at once.
 * Used by the Roster bulk toolbar.
 *
 * `level` can be any level name configured on the program (stored
 * lowercased), or the special value "cut", or null to unassign.
 */
export async function bulkSetPlayerLevelAction(
  playerIds: string[],
  level: string | null,
): Promise<{ error: string | null; updated: number }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE, updated: 0 };
  if (playerIds.length === 0) return { error: null, updated: 0 };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", updated: 0 };
  const supabase = createSupabaseServerClient();

  if (level === null) {
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .in("player_id", playerIds)
      .eq("program_id", coach.program_id);
    if (error) return { error: error.message, updated: 0 };
  } else {
    // roster_assignments has UNIQUE(player_id) — a player has exactly
    // one assignment at a time. Upsert against that single column.
    const rows = playerIds.map((pid) => ({
      player_id: pid,
      program_id: coach.program_id,
      assignment: level,
      assigned_by: coach.id,
    }));
    const { error } = await supabase
      .from("roster_assignments")
      .upsert(rows, { onConflict: "player_id" });
    if (error) return { error: error.message, updated: 0 };
  }
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, updated: playerIds.length };
}

/**
 * setPlayerLevelAction — upsert a single roster_assignments row.
 * Used by the inline level pill on the roster table.
 *
 * `level` can be any level name configured on the program (stored
 * lowercased), or the special value "cut", or null to unassign.
 */
export async function setPlayerLevelAction(
  playerId: string,
  level: string | null,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // null = remove any existing assignment (unassigned)
  if (level === null) {
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .eq("player_id", playerId)
      .eq("program_id", coach.program_id);
    if (error) return { error: error.message };
  } else {
    // UNIQUE(player_id) — one active assignment per player.
    const { error } = await supabase
      .from("roster_assignments")
      .upsert(
        {
          player_id: playerId,
          program_id: coach.program_id,
          assignment: level,
          assigned_by: coach.id,
        },
        { onConflict: "player_id" },
      );
    if (error) return { error: error.message };
  }
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

/**
 * bulkCreatePlayersAction — insert many player rows at once.
 * Returns inserted + skipped + invalid counts. Each row is independently
 * validated by BulkPlayerSchema; rows that fail validation are skipped
 * and counted in `invalid` rather than blocking the whole batch (the
 * coach probably wants the 23 good rows even if 2 are malformed).
 *
 * Skips rows with duplicate (firstName + lastName) against the existing
 * roster, case-insensitive.
 */
export async function bulkCreatePlayersAction(
  rows: BulkPlayer[],
): Promise<{ error: string | null; inserted: number; skipped: number; invalid: number }> {
  if (isDemoRequest()) {
    return { error: DEMO_GUARD_MESSAGE, inserted: 0, skipped: 0, invalid: 0 };
  }
  if (rows.length === 0) {
    return { error: "No rows to import.", inserted: 0, skipped: 0, invalid: 0 };
  }

  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", inserted: 0, skipped: 0, invalid: 0 };

  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("players")
    .select("first_name, last_name")
    .eq("program_id", coach.program_id);
  const seen = new Set(
    (existing ?? []).map(
      (p: { first_name: string; last_name: string }) =>
        `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`,
    ),
  );

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  let invalid = 0;
  for (const r of rows) {
    const parsed = BulkPlayerSchema.safeParse(r);
    if (!parsed.success) {
      invalid++;
      continue;
    }
    const safe = parsed.data;
    const key = `${safe.firstName.toLowerCase()}|${safe.lastName.toLowerCase()}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push({
      program_id: coach.program_id,
      first_name: safe.firstName,
      last_name: safe.lastName,
      grade: safe.grade,
      positions: safe.positions,
      bats: safe.bats,
      throws: safe.throws,
      player_number: safe.playerNumber,
    });
  }

  if (toInsert.length === 0) {
    revalidatePath("/app/roster");
    return { error: null, inserted: 0, skipped, invalid };
  }

  const { error } = await supabase.from("players").insert(toInsert);
  if (error) return { error: error.message, inserted: 0, skipped, invalid };

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, inserted: toInsert.length, skipped, invalid };
}

// ── GameChanger stats import ────────────────────────────────────

export interface ImportStatsInput {
  sourceNote: string;
  seasonYear: number;
  levelAssignment?: string; // e.g. "jv" — if set, auto-assign imported players
  players: Array<{
    jersey: number | null;
    firstName: string;
    lastName: string;
    primaryPosition: string | null;
    batting: {
      gp: number; pa: number; ab: number; h: number;
      singles: number; doubles: number; triples: number; hr: number;
      rbi: number; r: number; bb: number; k: number; hbp: number;
      sac: number; sb: number;
      ba: number; obp: number; slg: number; ops: number;
    };
    pitching: {
      gp: number; gs: number; w: number; l: number; sv: number;
      bf: number; outs: number; ip: number; pitches: number;
      h: number; hr: number; r: number; er: number;
      bb: number; hbp: number; k: number;
      era: number; whip: number; k9: number; bb9: number; baa: number;
    };
  }>;
}

/**
 * importGameChangerStatsAction — in one pass:
 *   1. Upserts players by (firstName + lastName), creating any who
 *      aren't on the roster yet.
 *   2. Assigns them to the provided level (e.g. "jv") if specified.
 *   3. Upserts imported batting + pitching rows for (program, player, season).
 *
 * Idempotent — re-running with the same CSV overwrites the previous
 * import. The file is the source of truth.
 */
export async function importGameChangerStatsAction(
  input: ImportStatsInput,
): Promise<{
  error: string | null;
  playersCreated: number;
  playersUpdated: number;
  battingRows: number;
  pitchingRows: number;
}> {
  if (isDemoRequest()) {
    return {
      error: DEMO_GUARD_MESSAGE,
      playersCreated: 0,
      playersUpdated: 0,
      battingRows: 0,
      pitchingRows: 0,
    };
  }
  const coach = await getCurrentCoach();
  if (!coach) {
    return {
      error: "No program. Set up your program first.",
      playersCreated: 0,
      playersUpdated: 0,
      battingRows: 0,
      pitchingRows: 0,
    };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Match existing roster
  const { data: existing } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .eq("program_id", coach.program_id);
  const byKey = new Map<string, string>(); // "first|last" (lower) → player_id
  for (const p of existing ?? []) {
    const k = `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`;
    byKey.set(k, p.id);
  }

  let playersCreated = 0;
  let playersUpdated = 0;
  const rosterIdByRow = new Map<number, string>(); // input index → player_id

  // 2. Create missing players
  const toInsert: Record<string, unknown>[] = [];
  const insertIdx: number[] = [];
  for (let i = 0; i < input.players.length; i++) {
    const p = input.players[i];
    const k = `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}`;
    const existingId = byKey.get(k);
    if (existingId) {
      rosterIdByRow.set(i, existingId);
    } else {
      toInsert.push({
        program_id: coach.program_id,
        first_name: p.firstName,
        last_name: p.lastName,
        player_number: p.jersey,
        positions: p.primaryPosition ? [p.primaryPosition] : [],
      });
      insertIdx.push(i);
    }
  }
  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from("players")
      .insert(toInsert)
      .select("id");
    if (insertErr) {
      return {
        error: `Couldn't create players: ${insertErr.message}`,
        playersCreated: 0,
        playersUpdated: 0,
        battingRows: 0,
        pitchingRows: 0,
      };
    }
    (inserted ?? []).forEach((row, j) => {
      rosterIdByRow.set(insertIdx[j], row.id);
    });
    playersCreated = inserted?.length ?? 0;
  }

  // 3. Optional: assign everyone to the chosen level
  if (input.levelAssignment) {
    const rows = Array.from(rosterIdByRow.values()).map((playerId) => ({
      program_id: coach.program_id,
      player_id: playerId,
      assignment: input.levelAssignment!.toLowerCase(),
    }));
    await supabase
      .from("roster_assignments")
      .upsert(rows, { onConflict: "program_id,player_id" });
  }

  // 4. Upsert batting rows
  const battingRows = input.players.map((p, i) => {
    const playerId = rosterIdByRow.get(i);
    if (!playerId) return null;
    return {
      program_id: coach.program_id,
      player_id: playerId,
      season_year: input.seasonYear,
      games: p.batting.gp,
      pa: p.batting.pa,
      ab: p.batting.ab,
      h: p.batting.h,
      singles: p.batting.singles,
      doubles: p.batting.doubles,
      triples: p.batting.triples,
      hr: p.batting.hr,
      bb: p.batting.bb,
      hbp: p.batting.hbp,
      k: p.batting.k,
      sac: p.batting.sac,
      rbi: p.batting.rbi,
      r: p.batting.r,
      sb: p.batting.sb,
      ba: p.batting.ba,
      obp: p.batting.obp,
      slg: p.batting.slg,
      ops: p.batting.ops,
      source: "gamechanger",
      source_note: input.sourceNote,
      imported_at: new Date().toISOString(),
      imported_by: user?.id ?? null,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (battingRows.length > 0) {
    const { error: batErr } = await supabase
      .from("player_imported_batting")
      .upsert(battingRows, { onConflict: "program_id,player_id,season_year" });
    if (batErr) {
      return {
        error: `Batting import failed: ${batErr.message}`,
        playersCreated,
        playersUpdated,
        battingRows: 0,
        pitchingRows: 0,
      };
    }
  }

  // 5. Upsert pitching rows (only for players with any pitching activity)
  const pitchingInsertRows = input.players
    .map((p, i) => {
      const playerId = rosterIdByRow.get(i);
      if (!playerId) return null;
      // Skip pitchers with 0 BF — they didn't pitch
      if (p.pitching.bf === 0 && p.pitching.outs === 0) return null;
      return {
        program_id: coach.program_id,
        player_id: playerId,
        season_year: input.seasonYear,
        games: p.pitching.gp,
        games_started: p.pitching.gs,
        wins: p.pitching.w,
        losses: p.pitching.l,
        saves: p.pitching.sv,
        bf: p.pitching.bf,
        outs: p.pitching.outs,
        ip: p.pitching.ip,
        pitches: p.pitching.pitches,
        h: p.pitching.h,
        hr: p.pitching.hr,
        r: p.pitching.r,
        er: p.pitching.er,
        bb: p.pitching.bb,
        hbp: p.pitching.hbp,
        k: p.pitching.k,
        era: p.pitching.era,
        whip: p.pitching.whip,
        k9: p.pitching.k9,
        bb9: p.pitching.bb9,
        baa: p.pitching.baa,
        source: "gamechanger",
        source_note: input.sourceNote,
        imported_at: new Date().toISOString(),
        imported_by: user?.id ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (pitchingInsertRows.length > 0) {
    const { error: pitErr } = await supabase
      .from("player_imported_pitching")
      .upsert(pitchingInsertRows, { onConflict: "program_id,player_id,season_year" });
    if (pitErr) {
      return {
        error: `Pitching import failed: ${pitErr.message}`,
        playersCreated,
        playersUpdated,
        battingRows: battingRows.length,
        pitchingRows: 0,
      };
    }
  }

  revalidatePath("/app/roster");
  revalidatePath("/app");

  return {
    error: null,
    playersCreated,
    playersUpdated,
    battingRows: battingRows.length,
    pitchingRows: pitchingInsertRows.length,
  };
}

/**
 * deleteAllPlayersAction — wipes every player on the coach's program.
 * Used by the roster footer's "clear" action (future).
 */
export async function deleteAllPlayersAction(): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  return { error: null };
}

// ── Player profile media + announcements ────────────────────────

/**
 * Update the profile-media fields on a player. Coach or the player
 * themselves (if they've claimed their profile) can call this.
 *
 * URLs validated as http(s); commitment year + status checked against
 * a fixed enum + plausibility window. Empty strings normalize to null.
 */
export async function updatePlayerProfileMediaAction(
  input: UpdatePlayerProfileMediaInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = UpdatePlayerProfileMediaSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const safe = parsed.data;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Verify caller is either a coach on the player's program OR the
  // claimed player themselves. RLS will re-enforce but we short-circuit.
  const { data: player } = await supabase
    .from("players")
    .select("id, program_id, claimed_by_user_id")
    .eq("id", safe.playerId)
    .maybeSingle();
  if (!player) return { error: "Player not found." };

  const isOwner = player.claimed_by_user_id === user.id;
  let isCoach = false;
  if (!isOwner) {
    const { data: c } = await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", user.id)
      .eq("program_id", player.program_id)
      .maybeSingle();
    isCoach = Boolean(c);
  }
  if (!isOwner && !isCoach) return { error: "Not authorized." };

  // Build patch with only the fields the caller actually sent. Zod
  // transforms convert "" → null for URL/text fields.
  const patch: Record<string, unknown> = {};
  if (input.avatarUrl !== undefined) patch.avatar_url = safe.avatarUrl;
  if (input.headerUrl !== undefined) patch.header_url = safe.headerUrl;
  if (input.highlightVideoUrl !== undefined) patch.highlight_video_url = safe.highlightVideoUrl;
  if (input.commitmentStatus !== undefined) patch.commitment_status = safe.commitmentStatus;
  if (input.commitmentSchool !== undefined) patch.commitment_school = safe.commitmentSchool;
  if (input.commitmentYear !== undefined) patch.commitment_year = safe.commitmentYear;
  if (input.commitmentNote !== undefined) patch.commitment_note = safe.commitmentNote;

  const { error } = await supabase.from("players").update(patch).eq("id", safe.playerId);
  if (error) return { error: error.message };

  revalidatePath(`/p/${safe.playerId}`);
  revalidatePath("/app/roster");
  revalidatePath("/me");
  return { error: null };
}

/**
 * Post to a player's announcement feed. RLS enforces that the caller
 * is either the coach or the claimed player — so this works for both
 * paths.
 */
export async function createPlayerAnnouncementAction(
  input: CreatePlayerAnnouncementInput,
): Promise<{ error: string | null; id?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = CreatePlayerAnnouncementSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const safe = parsed.data;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("player_announcements")
    .insert({
      player_id: safe.playerId,
      posted_by: user.id,
      kind: safe.kind,
      title: safe.title,
      body: safe.body,
      image_url: safe.imageUrl,
      link_url: safe.linkUrl,
      pinned: safe.pinned,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't post." };

  revalidatePath(`/p/${safe.playerId}`);
  revalidatePath("/app/roster");
  return { error: null, id: data.id };
}

export async function deletePlayerAnnouncementAction(
  announcementId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("player_announcements")
    .delete()
    .eq("id", announcementId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function togglePinAnnouncementAction(
  announcementId: string,
  pinned: boolean,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("player_announcements")
    .update({ pinned })
    .eq("id", announcementId);
  if (error) return { error: error.message };
  return { error: null };
}
