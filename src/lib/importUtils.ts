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
  // Also try without spaces for compound terms
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
