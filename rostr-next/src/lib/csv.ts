/**
 * Minimal CSV parser. Handles quoted fields, embedded commas, escaped
 * quotes (""), Windows \r\n line endings. Good enough for coach-scale
 * rosters (hundreds of rows), not a DB dump.
 */
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      if (row.some((f) => f.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim().length > 0)) rows.push(row);
  }
  return rows;
}

// ── Auto-mapping for common column names ────────────────────────

const HEADERS: Record<string, string> = {
  // first name
  "first name": "firstName",
  firstname: "firstName",
  first: "firstName",
  fname: "firstName",
  given: "firstName",
  // last name
  "last name": "lastName",
  lastname: "lastName",
  last: "lastName",
  lname: "lastName",
  surname: "lastName",
  family: "lastName",
  // combined name
  name: "fullName",
  "player name": "fullName",
  player: "fullName",
  // jersey number
  "jersey": "playerNumber",
  "jersey number": "playerNumber",
  "jersey #": "playerNumber",
  "#": "playerNumber",
  number: "playerNumber",
  uniform: "playerNumber",
  // grade / class
  grade: "grade",
  "grade level": "grade",
  class: "classYear",
  "class year": "classYear",
  "grad year": "classYear",
  year: "classYear",
  // positions
  position: "positions",
  positions: "positions",
  pos: "positions",
  // bats
  bats: "bats",
  b: "bats",
  // throws
  throws: "throws",
  t: "throws",
  "b/t": "batsThrows",
  "bats/throws": "batsThrows",
};

export interface ParsedPlayer {
  firstName: string;
  lastName: string;
  grade?: number | null;
  positions?: string[];
  bats?: "L" | "R" | "S" | null;
  throws?: "L" | "R" | null;
  playerNumber?: number | null;
  /** Row was unparseable (missing name); flagged for the preview. */
  invalid?: boolean;
  /** Original row index in the source CSV for error messaging. */
  sourceRow: number;
}

function normalizeHeader(h: string): string | null {
  const k = h.trim().toLowerCase();
  return HEADERS[k] ?? null;
}

function parseGrade(s: string | undefined): number | null {
  if (!s) return null;
  const v = s.trim();
  const m = v.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  // Handle "12", "Sr", grad year like 2026 → approximate as Sr
  if (n >= 9 && n <= 12) return n;
  if (n >= 2023 && n <= 2040) {
    const now = new Date().getFullYear();
    const grade = 12 - Math.max(0, n - now);
    return Math.max(9, Math.min(12, grade));
  }
  return null;
}

function parseBats(s: string | undefined): "L" | "R" | "S" | null {
  if (!s) return null;
  const c = s.trim().toUpperCase().charAt(0);
  if (c === "L" || c === "R" || c === "S") return c;
  return null;
}

function parseThrows(s: string | undefined): "L" | "R" | null {
  if (!s) return null;
  const c = s.trim().toUpperCase().charAt(0);
  if (c === "L" || c === "R") return c;
  return null;
}

function parsePositions(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[\s/,|;]+/)
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p.length > 0 && p.length <= 3);
}

/**
 * Parse a block of CSV text into structured ParsedPlayer rows.
 * First row is treated as header. Returns all rows including invalid
 * (for the preview to show skipped entries).
 */
export function parsePlayerCsv(raw: string): ParsedPlayer[] {
  const rows = parseCsv(raw);
  if (rows.length === 0) return [];

  const headerRow = rows[0];
  const colMap: Record<number, string> = {};
  headerRow.forEach((h, i) => {
    const mapped = normalizeHeader(h);
    if (mapped) colMap[i] = mapped;
  });

  const out: ParsedPlayer[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const byKey: Record<string, string> = {};
    row.forEach((cell, i) => {
      const k = colMap[i];
      if (k) byKey[k] = cell;
    });

    let firstName = byKey.firstName?.trim() ?? "";
    let lastName = byKey.lastName?.trim() ?? "";

    // If only "Name" was provided, split on space.
    if (!firstName && !lastName && byKey.fullName) {
      const full = byKey.fullName.trim();
      // Handle "Last, First" and "First Last"
      if (full.includes(",")) {
        const [l, f] = full.split(",").map((s) => s.trim());
        firstName = f ?? "";
        lastName = l ?? "";
      } else {
        const parts = full.split(/\s+/);
        firstName = parts[0] ?? "";
        lastName = parts.slice(1).join(" ");
      }
    }

    // B/T combined → "R/R" etc.
    let bats: "L" | "R" | "S" | null = parseBats(byKey.bats);
    let throws: "L" | "R" | null = parseThrows(byKey.throws);
    if (byKey.batsThrows) {
      const [b, t] = byKey.batsThrows.split(/[\/-]/);
      if (!bats) bats = parseBats(b);
      if (!throws) throws = parseThrows(t);
    }

    const num = byKey.playerNumber ? parseInt(byKey.playerNumber.replace(/\D/g, ""), 10) : NaN;

    out.push({
      firstName,
      lastName,
      grade: parseGrade(byKey.grade ?? byKey.classYear),
      positions: parsePositions(byKey.positions),
      bats,
      throws,
      playerNumber: Number.isFinite(num) ? num : null,
      invalid: !firstName || !lastName,
      sourceRow: r + 1, // 1-based, including header
    });
  }

  return out;
}
