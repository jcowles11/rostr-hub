/**
 * Shared utilities for spreadsheet import (DataImport & RosterUpload)
 */

export function normalizeHeader(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}

const PLAYER_INFO_TERMS = [
  "first name", "last name", "firstname", "lastname",
  "name", "first", "last", "surname",
  "player name", "playername", "full name", "fullname", "athlete name", "athlete",
  "grade", "year", "class", "grad year", "graduation year",
  "position", "pos", "positions",
  "jersey", "number", "#", "num", "no",
  "bats", "throws", "b/t", "bats/throws", "bat/throw", "bats throws", "bats-throws",
  "ht", "height", "wt", "weight",
  "age", "dob", "birthday", "birth date", "birthdate", "date of birth",
  "email", "e mail", "phone", "cell", "mobile", "contact",
  "team", "school", "city", "state", "zip", "address",
  "parent", "guardian", "emergency",
  "notes", "note", "comment", "comments",
  "gpa", "travel", "travel ball",
  "instagram", "twitter", "social",
  "highlight", "video", "url", "link",
];

export function isPlayerInfoColumn(header: string): boolean {
  const norm = normalizeHeader(header);
  const normNoSpace = norm.replace(/\s/g, "");
  return PLAYER_INFO_TERMS.some((t) => {
    const tNorm = t.replace(/[\s_]/g, " ");
    const tNoSpace = t.replace(/[\s_]/g, "");
    return norm === tNorm || normNoSpace === tNoSpace;
  });
}

export function isNumericColumn(rows: Record<string, string>[], header: string): boolean {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 20);
  let numericCount = 0;
  let nonEmptyCount = 0;
  for (const r of sample) {
    const val = (r[header] || "").trim();
    if (val === "") continue;
    nonEmptyCount++;
    if (!isNaN(parseFloat(val)) && isFinite(Number(val))) {
      numericCount++;
    }
  }
  return nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.5;
}

export function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first: "", last: "" };
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    return { first: rest.join(",").trim(), last: last.trim() };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function splitBatsThrows(val: string): { bats: string; throws: string } {
  const trimmed = val.trim().toUpperCase();
  if (!trimmed) return { bats: "", throws: "" };
  const parts = trimmed.split(/[\/\-\\|,]/);
  if (parts.length >= 2) {
    return { bats: parts[0].trim().substring(0, 1), throws: parts[1].trim().substring(0, 1) };
  }
  return { bats: "", throws: "" };
}

/**
 * Represents a group of columns that belong to the same metric but are separate attempts.
 * E.g., "FB_Velo_1", "FB_Velo_2", ... "FB_Velo_5" → group name "FB Velo", columns in order.
 */
export interface ColumnGroup {
  /** Display name for the group, e.g. "FB Velo" */
  displayName: string;
  /** Original headers in attempt order */
  columns: string[];
}

/**
 * Detects attempt-numbered columns (e.g., "FB_Velo_1", "FB_Velo_2") and groups them.
 * Columns without a trailing _N are treated as single-column groups.
 * Only numeric columns are included. Player-info columns and name-mapped columns are excluded.
 */
export function groupAttemptColumns(
  headers: string[],
  rows: Record<string, string>[],
  nameColumns: Set<string>
): ColumnGroup[] {
  const groupMap = new Map<string, string[]>();
  const soloColumns: string[] = [];

  for (const header of headers) {
    if (nameColumns.has(header)) continue;
    if (isPlayerInfoColumn(header)) continue;
    if (!isNumericColumn(rows, header)) continue;

    // Check for trailing _N or space N pattern
    const attemptMatch = header.match(/^(.+?)[_\s](\d+)$/);
    if (attemptMatch) {
      const baseName = attemptMatch[1];
      if (!groupMap.has(baseName)) {
        groupMap.set(baseName, []);
      }
      groupMap.get(baseName)!.push(header);
    } else {
      soloColumns.push(header);
    }
  }

  const groups: ColumnGroup[] = [];

  // Add grouped columns sorted by attempt number
  for (const [baseName, columns] of groupMap) {
    columns.sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)$/)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)$/)?.[1] || "0");
      return aNum - bNum;
    });
    // Make display name more readable: "FB_Velo" → "FB Velo"
    const displayName = baseName.replace(/[_]+/g, " ").trim();
    groups.push({ displayName, columns });
  }

  // Add solo columns
  for (const header of soloColumns) {
    const displayName = header.replace(/[_]+/g, " ").trim();
    groups.push({ displayName, columns: [header] });
  }

  return groups;
}
