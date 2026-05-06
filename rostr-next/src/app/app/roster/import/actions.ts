"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import {
  requirePermission,
  PermissionDeniedError,
} from "@/lib/permissions/server";
import {
  parseGameChangerRosterCsv,
  type ParsedRow,
  type ParseResult,
} from "@/lib/services/gamechanger-import";
import { gradeMeetsAgeFloor } from "@/lib/compliance/age-gate";

/**
 * Server action for /app/roster/import.
 *
 * Two-stage flow on the client:
 *
 *   1. Coach pastes CSV text → previewImportAction returns the parsed
 *      rows + errors so the coach reviews before committing.
 *   2. Coach clicks "Import N players" → commitImportAction inserts.
 *
 * Pure parser lives in lib/services/gamechanger-import.ts; this file
 * just wires it to auth + DB writes. Required permission:
 * import_roster_csv (head_coach only).
 */

export interface PreviewResult extends ParseResult {
  /**
   * Players in the program who appear (by exact first+last name match)
   * to be the same as a parsed row. Coach can choose to skip these.
   */
  potentialDuplicates: Array<{ rowIndex: number; existingPlayerId: string }>;
}

export async function previewImportAction(
  csvText: string,
): Promise<{ result: PreviewResult | null; error: string | null }> {
  if (isDemoRequest()) return { result: null, error: DEMO_GUARD_MESSAGE };
  if (!csvText || typeof csvText !== "string") {
    return { result: null, error: "No CSV provided." };
  }
  if (csvText.length > 200_000) {
    return {
      result: null,
      error: "CSV exceeds size limit (200 KB). Split it into batches.",
    };
  }

  let ctx;
  try {
    ctx = await requirePermission("import_roster_csv");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { result: null, error: e.message };
    }
    throw e;
  }

  const parse = parseGameChangerRosterCsv(csvText);

  // Duplicate detection — exact (first_name, last_name) match against
  // the active roster of any program the coach manages.
  const supabase = createSupabaseServerClient();
  const programIds = ctx.memberships.map((m) => m.programId);
  const potentialDuplicates: PreviewResult["potentialDuplicates"] = [];
  if (parse.rows.length > 0 && programIds.length > 0) {
    const { data: existing } = await supabase
      .from("players")
      .select("id, first_name, last_name, program_id, released_at")
      .in("program_id", programIds);
    const byName = new Map<string, string>();
    for (const p of existing ?? []) {
      const r = p as {
        id: string;
        first_name: string;
        last_name: string;
        released_at: string | null;
      };
      if (r.released_at) continue;
      const key = `${r.first_name.trim().toLowerCase()}|${r.last_name.trim().toLowerCase()}`;
      byName.set(key, r.id);
    }
    for (const row of parse.rows) {
      const key = `${row.firstName.trim().toLowerCase()}|${row.lastName.trim().toLowerCase()}`;
      const id = byName.get(key);
      if (id) potentialDuplicates.push({ rowIndex: row.rowIndex, existingPlayerId: id });
    }
  }

  return {
    result: { ...parse, potentialDuplicates },
    error: null,
  };
}

export interface CommitImportInput {
  programId: string;
  /** Subset of parsed rows the coach chose to import (after review). */
  rows: ParsedRow[];
}

export interface CommitImportResult {
  inserted: number;
  failed: Array<{ rowIndex: number; error: string }>;
}

export async function commitImportAction(
  input: CommitImportInput,
): Promise<{ result: CommitImportResult | null; error: string | null }> {
  if (isDemoRequest()) return { result: null, error: DEMO_GUARD_MESSAGE };
  if (!input.programId) return { result: null, error: "Missing program id." };
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { result: null, error: "No rows to import." };
  }
  if (input.rows.length > 200) {
    return {
      result: null,
      error: "Up to 200 players per import. Split into batches.",
    };
  }

  let ctx;
  try {
    ctx = await requirePermission("import_roster_csv");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { result: null, error: e.message };
    }
    throw e;
  }

  // Verify the coach has head_coach permission specifically for the
  // target program (not just any program).
  const inThisProgram = ctx.memberships.find(
    (m) => m.programId === input.programId,
  );
  if (!inThisProgram || inThisProgram.role !== "head_coach") {
    return {
      result: null,
      error: "You can only import roster into a program where you're head coach.",
    };
  }

  const supabase = createSupabaseServerClient();
  const failed: CommitImportResult["failed"] = [];
  let inserted = 0;

  for (const row of input.rows) {
    if (!row.firstName.trim() || !row.lastName.trim()) {
      failed.push({ rowIndex: row.rowIndex, error: "Missing name." });
      continue;
    }
    // COPPA hard floor: don't import under-13 players. Migration 40
    // also enforces this at the DB layer; the app-layer check gives
    // a friendlier per-row error message instead of a constraint
    // violation toast.
    if (!gradeMeetsAgeFloor(row.grade)) {
      failed.push({
        rowIndex: row.rowIndex,
        error:
          "Grade is below 9 (under 13 not supported). Drop this row or correct the grade.",
      });
      continue;
    }
    const { error } = await supabase.from("players").insert({
      program_id: input.programId,
      first_name: row.firstName.trim(),
      last_name: row.lastName.trim(),
      grade: row.grade,
      positions: row.positions,
      player_number: row.jerseyNumber,
      bats: row.bats,
      throws: row.throws,
      // Default to NOT public — must be re-enabled with consent flow.
      profile_public: false,
    });
    if (error) {
      failed.push({ rowIndex: row.rowIndex, error: error.message });
    } else {
      inserted++;
    }
  }

  revalidatePath("/app/roster");
  return { result: { inserted, failed }, error: null };
}
