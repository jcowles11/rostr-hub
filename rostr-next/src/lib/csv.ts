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
  /** Row was unparseable or failed validation; flagged for the preview. */
  invalid?: boolean;
  /** Short, human-readable reason for why the row is invalid (if it is). */
  invalidReason?: string;
  /** Warnings that don't block import — e.g. truncated jersey number. */
  warnings?: string[];
  /** Original row index in the source CSV for error messaging. */
  sourceRow: number;
}

// Rostr-recognized baseball position codes. Rows with unknown codes keep
// the value but earn a warning, so a coach's typo becomes visible.
const VALID_POSITIONS = new Set([
  "P", "C",
  "1B", "2B", "3B", "SS",
  "LF", "CF", "RF", "OF",
  "DH", "UT",
]);

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
    const grade = parseGrade(byKey.grade ?? byKey.classYear);
    const positions = parsePositions(byKey.positions);

    // ── Validation ──────────────────────────────────────────────────
    // Invalid = block insert. Warning = flag but still insert.
    const warnings: string[] = [];
    let invalid = false;
    let invalidReason: string | undefined;

    if (!firstName && !lastName) {
      invalid = true;
      invalidReason = "Missing first + last name";
    } else if (!firstName) {
      invalid = true;
      invalidReason = "Missing first name";
    } else if (!lastName) {
      invalid = true;
      invalidReason = "Missing last name";
    }

    // Jersey number out-of-range → clamp + warn, don't block.
    let jersey: number | null = Number.isFinite(num) ? num : null;
    if (jersey != null && (jersey < 0 || jersey > 999)) {
      warnings.push(`Jersey ${jersey} looks off — dropped`);
      jersey = null;
    }

    // Grade inferred from an unknown value: warn (we already stored null).
    if (!invalid && grade == null && (byKey.grade || byKey.classYear)) {
      warnings.push(`Couldn't parse grade "${byKey.grade ?? byKey.classYear}"`);
    }

    // Unknown positions → keep them, but flag.
    const unknownPositions = positions.filter((p) => !VALID_POSITIONS.has(p));
    if (unknownPositions.length > 0) {
      warnings.push(`Unknown position(s): ${unknownPositions.join(", ")}`);
    }

    // Typo-prone bats/throws: original cell wasn't empty but didn't resolve.
    if (byKey.bats && bats === null) {
      warnings.push(`Couldn't parse bats "${byKey.bats}"`);
    }
    if (byKey.throws && throws === null) {
      warnings.push(`Couldn't parse throws "${byKey.throws}"`);
    }

    out.push({
      firstName,
      lastName,
      grade,
      positions,
      bats,
      throws,
      playerNumber: jersey,
      invalid,
      invalidReason,
      warnings: warnings.length > 0 ? warnings : undefined,
      sourceRow: r + 1, // 1-based, including header
    });
  }

  return out;
}

// ── Column-mapping introspection ─────────────────────────────────
// Returns which logical fields were detected (or missing) from the
// header row. Powers the "column mapping detected" preview card.

export interface HeaderMapping {
  detected: Array<{ source: string; mapped: string }>;
  missing: string[];
}

export function detectHeaderMapping(raw: string): HeaderMapping {
  const rows = parseCsv(raw);
  if (rows.length === 0) return { detected: [], missing: [] };
  const headerRow = rows[0];
  const detected: HeaderMapping["detected"] = [];
  const present = new Set<string>();
  for (const h of headerRow) {
    const mapped = normalizeHeader(h);
    if (mapped) {
      detected.push({ source: h.trim(), mapped });
      present.add(mapped);
    }
  }
  // fullName covers firstName + lastName in one column.
  const namePresent = present.has("firstName") || present.has("lastName") || present.has("fullName");
  const missing: string[] = [];
  if (!namePresent) missing.push("name");
  return { detected, missing };
}

// ═══════════════════════════════════════════════════════════════
// GameChanger stats CSV parser
// ═══════════════════════════════════════════════════════════════
//
// GameChanger's team stats export looks like:
//
//   Row 1 — Section groups: "","","","Batting","","","Pitching","","Fielding",...
//   Row 2 — Field headers:  Number,Last,First,GP,PA,AB,...,IP,W,L,...,TC,A,PO,...
//   Row 3 — Data:           "1","Vaughn","Kaiden","6","19","15",...
//   ...
//   Row N-2 — Totals:       "Totals","","","11","363","281",...
//   Row N-1 — Blank
//   Row N   — Glossary line
//
// We drop rows 1 (section groups), totals rows, and any row without a
// Last+First. Field headers in row 2 are ambiguous (e.g. "H" appears
// in both Batting and Pitching) — we disambiguate by column index,
// using the section-group row to know when we've entered pitching vs
// fielding sections.

/** Convert GameChanger cell values ("-", ".133", "100.0") to number|null. */
function gcNum(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.trim();
  if (s === "" || s === "-" || s === "—" || s === "N/A") return null;
  // ".133" → 0.133
  const withZero = s.startsWith(".") ? "0" + s : s;
  const n = parseFloat(withZero);
  return Number.isFinite(n) ? n : null;
}

function gcInt(v: string | undefined): number {
  const n = gcNum(v);
  return n == null ? 0 : Math.round(n);
}

function gcRate(v: string | undefined): number {
  const n = gcNum(v);
  return n == null ? 0 : n;
}

/** Normalize a curly apostrophe / right single quote mark to a plain ASCII '. */
function normalizeName(s: string): string {
  return s.replace(/[\u2018\u2019\u02BC]/g, "'").trim();
}

export interface GcBattingLine {
  gp: number; pa: number; ab: number; h: number;
  singles: number; doubles: number; triples: number; hr: number;
  rbi: number; r: number; bb: number; k: number; hbp: number;
  sac: number; sb: number;
  ba: number; obp: number; slg: number; ops: number;
}

export interface GcPitchingLine {
  gp: number; gs: number; w: number; l: number; sv: number;
  bf: number; outs: number; ip: number; pitches: number;
  h: number; hr: number; r: number; er: number;
  bb: number; hbp: number; k: number;
  era: number; whip: number; k9: number; bb9: number; baa: number;
}

export interface GcPlayerRow {
  jersey: number | null;
  lastName: string;
  firstName: string;
  batting: GcBattingLine;
  pitching: GcPitchingLine;
  /** Primary position inferred from the position-innings columns. */
  primaryPosition: string | null;
  sourceRow: number;
}

export interface GcStatsFile {
  players: GcPlayerRow[];
  seasonNote: string | null; // sniffed from filename if passed in
  totalsRowFound: boolean;
}

/**
 * Parse a GameChanger team stats CSV into structured per-player rows.
 * Tolerant of:
 *   - 2-row header (section groups + field names)
 *   - "-" / "" / "N/A" → 0 or null
 *   - ".333" style rate stats
 *   - Curly apostrophes in names (O'Connor, O'Brien)
 *   - Totals + glossary + trailing blank rows
 */
export function parseGameChangerStatsCsv(raw: string): GcStatsFile {
  const rows = parseCsv(raw);
  if (rows.length < 3) {
    return { players: [], seasonNote: null, totalsRowFound: false };
  }

  // Row 0: section groups (we only use this to find where pitching/fielding start)
  const groupRow = rows[0];
  // Row 1: field headers
  const headerRow = rows[1];

  // Find the column index where each section begins. A "Batting" cell
  // at column i means batting starts at i. Next non-empty group cell
  // is the next section's start.
  const sectionStarts: Array<{ name: string; start: number }> = [];
  for (let i = 0; i < groupRow.length; i++) {
    const g = groupRow[i]?.trim();
    if (g && g.length > 0) {
      sectionStarts.push({ name: g, start: i });
    }
  }
  const sectionAt = (i: number): string => {
    let current = "identity";
    for (const s of sectionStarts) {
      if (i >= s.start) current = s.name.toLowerCase();
      else break;
    }
    return current;
  };

  // Build two maps: batting-field → column index, pitching-field → column index.
  // Field headers repeat ("H", "BB", "HR") so the section context matters.
  const batCol: Record<string, number> = {};
  const pitCol: Record<string, number> = {};
  const fieldCol: Record<string, number> = {};
  const idCol: Record<string, number> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i]?.trim();
    if (!h) continue;
    const section = sectionAt(i);
    if (section === "identity" || section === "") {
      idCol[h] = i;
    } else if (section === "batting") {
      batCol[h] = i;
    } else if (section === "pitching") {
      pitCol[h] = i;
    } else if (section === "fielding") {
      fieldCol[h] = i;
    }
  }

  const numberIdx = idCol["Number"] ?? 0;
  const lastIdx = idCol["Last"] ?? 1;
  const firstIdx = idCol["First"] ?? 2;

  // Position innings columns in Fielding section: "P", "C", "1B", "2B",
  // "3B", "SS", "LF", "CF", "RF" — each has inning count. We pick the
  // max to infer primary position.
  const POS_CODES = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "SF"];
  const posCols: Record<string, number> = {};
  for (const p of POS_CODES) {
    if (fieldCol[p] != null) posCols[p] = fieldCol[p];
  }

  const players: GcPlayerRow[] = [];
  let totalsRowFound = false;

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const cell = (idx: number | undefined): string =>
      idx == null ? "" : (row[idx] ?? "").trim();

    const firstCell = (row[0] ?? "").trim();
    // Totals row
    if (firstCell.toLowerCase() === "totals") {
      totalsRowFound = true;
      continue;
    }
    // Glossary row
    if (firstCell.toLowerCase() === "glossary") continue;

    const last = normalizeName(cell(lastIdx));
    const first = normalizeName(cell(firstIdx));
    if (!last && !first) continue; // empty / separator row

    const jerseyRaw = cell(numberIdx);
    const jerseyN = parseInt(jerseyRaw.replace(/\D/g, ""), 10);
    const jersey = Number.isFinite(jerseyN) ? jerseyN : null;

    // Primary position = max innings among standard positions
    let primaryPosition: string | null = null;
    let maxInn = 0;
    for (const [code, idx] of Object.entries(posCols)) {
      const n = gcNum(row[idx]) ?? 0;
      if (n > maxInn) {
        maxInn = n;
        primaryPosition = code;
      }
    }

    const batting: GcBattingLine = {
      gp: gcInt(row[batCol["GP"]]),
      pa: gcInt(row[batCol["PA"]]),
      ab: gcInt(row[batCol["AB"]]),
      h: gcInt(row[batCol["H"]]),
      singles: gcInt(row[batCol["1B"]]),
      doubles: gcInt(row[batCol["2B"]]),
      triples: gcInt(row[batCol["3B"]]),
      hr: gcInt(row[batCol["HR"]]),
      rbi: gcInt(row[batCol["RBI"]]),
      r: gcInt(row[batCol["R"]]),
      bb: gcInt(row[batCol["BB"]]),
      // GameChanger uses "SO" for batting strikeouts
      k: gcInt(row[batCol["SO"]]),
      hbp: gcInt(row[batCol["HBP"]]),
      sac: gcInt(row[batCol["SAC"]]) + gcInt(row[batCol["SF"]]),
      sb: gcInt(row[batCol["SB"]]),
      ba: gcRate(row[batCol["AVG"]]),
      obp: gcRate(row[batCol["OBP"]]),
      slg: gcRate(row[batCol["SLG"]]),
      ops: gcRate(row[batCol["OPS"]]),
    };

    // IP in GC is "6.2" = 6 and 2/3 innings. Convert to outs for arithmetic.
    const ipRaw = gcNum(row[pitCol["IP"]]) ?? 0;
    const ipWhole = Math.floor(ipRaw);
    const ipFrac = ipRaw - ipWhole;
    // 0.1 → 1 out, 0.2 → 2 outs, 0.0 → 0 outs
    const fracOuts = ipFrac > 0.15 && ipFrac < 0.25 ? 1 : ipFrac > 0.5 ? 2 : 0;
    const outs = ipWhole * 3 + fracOuts;

    const pitching: GcPitchingLine = {
      // "GP" reused in pitching section; we want the pitching one
      gp: gcInt(row[pitCol["GP"]]),
      gs: gcInt(row[pitCol["GS"]]),
      w: gcInt(row[pitCol["W"]]),
      l: gcInt(row[pitCol["L"]]),
      sv: gcInt(row[pitCol["SV"]]),
      bf: gcInt(row[pitCol["BF"]]),
      outs,
      ip: ipRaw,
      pitches: gcInt(row[pitCol["#P"]]),
      h: gcInt(row[pitCol["H"]]),
      hr: gcInt(row[pitCol["HR"]]),
      r: gcInt(row[pitCol["R"]]),
      er: gcInt(row[pitCol["ER"]]),
      bb: gcInt(row[pitCol["BB"]]),
      hbp: gcInt(row[pitCol["HBP"]]),
      k: gcInt(row[pitCol["SO"]]),
      era: gcRate(row[pitCol["ERA"]]),
      whip: gcRate(row[pitCol["WHIP"]]),
      // GC doesn't have K9 directly — compute from K/BF via BAA as a proxy,
      // or fall back to 9 × K / IP.
      k9: outs > 0 ? Math.round((gcInt(row[pitCol["SO"]]) * 27 * 100) / outs) / 100 : 0,
      bb9: outs > 0 ? Math.round((gcInt(row[pitCol["BB"]]) * 27 * 100) / outs) / 100 : 0,
      baa: gcRate(row[pitCol["BAA"]]),
    };

    players.push({
      jersey,
      lastName: last,
      firstName: first,
      batting,
      pitching,
      primaryPosition,
      sourceRow: r + 1, // 1-based for error messaging
    });
  }

  return { players, seasonNote: null, totalsRowFound };
}

// Detector: is this a GameChanger stats export?
// Quick heuristic — section-header row 0 contains "Batting" and
// field-header row 1 contains "AVG" + "OPS".
export function isGameChangerStatsCsv(raw: string): boolean {
  const rows = parseCsv(raw);
  if (rows.length < 2) return false;
  const groupCells = rows[0].map((c) => c.trim().toLowerCase());
  const headerCells = rows[1].map((c) => c.trim().toUpperCase());
  return (
    groupCells.includes("batting") &&
    headerCells.includes("AVG") &&
    headerCells.includes("OPS")
  );
}
