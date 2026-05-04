/**
 * GameChanger roster CSV parser.
 *
 * GameChanger's roster export is a flat CSV with an inconsistent
 * column set across years + sports. This parser is permissive: it
 * looks for known column-name patterns (case-insensitive, whitespace-
 * tolerant) and maps them to Rostr's player schema.
 *
 * Out-of-scope for v1:
 *   - GameChanger's stat history. Only the roster row is imported
 *     here. Stat import would need a separate event-stream parse +
 *     mapping, which is a future migration.
 *   - GameChanger's photo/avatar URLs. They're hosted on a CDN we
 *     can't proxy reliably without copying the asset; coach can
 *     re-upload on Rostr.
 *
 * Safety:
 *   - Pure parser, no DB writes. Returns ParsedRow[] + ParseError[].
 *   - Caller (server action) does the actual insert with all the
 *     usual validation + program scoping.
 */

export interface ParsedRow {
  rowIndex: number; // 0-based row in the source CSV (excluding header)
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  positions: string[];
  bats: "L" | "R" | "S" | null;
  throws: "L" | "R" | null;
  grade: number | null;
  graduationYear: number | null;
  /**
   * Raw source row for reference / debugging. Not persisted.
   */
  raw: Record<string, string>;
}

export interface ParseError {
  rowIndex: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  /** Header columns the parser recognized + mapped. */
  recognizedColumns: string[];
  /** Header columns that were ignored. */
  unrecognizedColumns: string[];
}

// ── Column header recognition ────────────────────────────────────

/**
 * Known column-name patterns. Each tuple is [canonical key, regex
 * patterns to match the source header against]. First match wins.
 */
const COLUMN_PATTERNS: Array<[
  | "firstName"
  | "lastName"
  | "fullName"
  | "jerseyNumber"
  | "positions"
  | "bats"
  | "throws"
  | "grade"
  | "graduationYear",
  RegExp[],
]> = [
  ["firstName", [/^first\s*name$/i, /^first$/i, /^fname$/i]],
  ["lastName", [/^last\s*name$/i, /^last$/i, /^lname$/i, /^surname$/i]],
  ["fullName", [/^name$/i, /^player\s*name$/i, /^full\s*name$/i]],
  ["jerseyNumber", [/^jersey/i, /^number$/i, /^#$/, /^uniform/i]],
  ["positions", [/^position/i, /^pos$/i]],
  ["bats", [/^bats?$/i, /^batting$/i, /^b\/t$/i]],
  ["throws", [/^throws$/i, /^throwing$/i]],
  ["grade", [/^grade$/i, /^grade\s*level$/i, /^year$/i]],
  ["graduationYear", [/^grad/i, /^class\s*of$/i, /^class\s*year$/i]],
];

function recognizeColumn(header: string): string | null {
  for (const [key, patterns] of COLUMN_PATTERNS) {
    for (const re of patterns) {
      if (re.test(header.trim())) return key;
    }
  }
  return null;
}

// ── Field-value normalizers ──────────────────────────────────────

function parseJersey(v: string): number | null {
  const t = v.trim().replace(/^#/, "");
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < 0 || n > 999) return null;
  return Math.floor(n);
}

function parsePositions(v: string): string[] {
  if (!v.trim()) return [];
  // GameChanger uses "/" or "," — split on both.
  return v
    .split(/[\/,]/)
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p.length > 0)
    .map(normalizePosition);
}

function normalizePosition(p: string): string {
  // GameChanger uses numbered positions sometimes (1=P, 2=C, ...)
  // and abbreviations sometimes. Normalize to Rostr's convention.
  const map: Record<string, string> = {
    "1": "P",
    "2": "C",
    "3": "1B",
    "4": "2B",
    "5": "3B",
    "6": "SS",
    "7": "LF",
    "8": "CF",
    "9": "RF",
    PITCHER: "P",
    CATCHER: "C",
    FIRSTBASE: "1B",
    "1ST": "1B",
    SECONDBASE: "2B",
    "2ND": "2B",
    THIRDBASE: "3B",
    "3RD": "3B",
    SHORT: "SS",
    SHORTSTOP: "SS",
    OUTFIELD: "OF",
    LEFTFIELD: "LF",
    CENTERFIELD: "CF",
    RIGHTFIELD: "RF",
    DESIGNATEDHITTER: "DH",
  };
  const cleaned = p.replace(/[^A-Z0-9]/g, "");
  return map[cleaned] ?? p;
}

function parseHandedness(v: string): "L" | "R" | "S" | null {
  const t = v.trim().toUpperCase();
  if (t === "L" || t === "LEFT") return "L";
  if (t === "R" || t === "RIGHT") return "R";
  if (t === "S" || t === "SWITCH" || t === "B") return "S";
  return null;
}

function parseGrade(v: string): number | null {
  const t = v.trim().toUpperCase();
  if (!t) return null;
  // Plain number first
  const n = Number(t);
  if (!Number.isNaN(n) && n >= 1 && n <= 12) return Math.floor(n);
  // Word-form
  if (t === "FRESHMAN" || t === "FR") return 9;
  if (t === "SOPHOMORE" || t === "SO" || t === "SOPH") return 10;
  if (t === "JUNIOR" || t === "JR") return 11;
  if (t === "SENIOR" || t === "SR") return 12;
  return null;
}

function parseGraduationYear(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  // Accept '24 or 2024 etc.
  if (n >= 20 && n <= 40) return 2000 + n;
  if (n >= 2020 && n <= 2040) return n;
  return null;
}

// ── CSV split (RFC 4180-ish; quoted-comma-aware) ──────────────────

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur.length === 0) {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ── Public API ───────────────────────────────────────────────────

export function parseGameChangerRosterCsv(csvText: string): ParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      rows: [],
      errors: [{ rowIndex: -1, message: "Empty CSV." }],
      recognizedColumns: [],
      unrecognizedColumns: [],
    };
  }

  const headerRaw = splitCSVLine(lines[0]);
  const headerKeys = headerRaw.map(recognizeColumn);
  const recognizedColumns = headerRaw.filter((_, i) => headerKeys[i] !== null);
  const unrecognizedColumns = headerRaw.filter((_, i) => headerKeys[i] === null);

  // Must have at least firstName + lastName (or fullName)
  const hasFirst = headerKeys.includes("firstName");
  const hasLast = headerKeys.includes("lastName");
  const hasFull = headerKeys.includes("fullName");
  if (!((hasFirst && hasLast) || hasFull)) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: -1,
          message:
            "Could not find name columns. Expected 'First Name' + 'Last Name', or a single 'Name' column.",
        },
      ],
      recognizedColumns,
      unrecognizedColumns,
    };
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const raw: Record<string, string> = {};
    headerRaw.forEach((h, idx) => {
      raw[h] = (cells[idx] ?? "").trim();
    });

    const get = (key: string): string => {
      const idx = headerKeys.findIndex((k) => k === key);
      if (idx < 0) return "";
      return (cells[idx] ?? "").trim();
    };

    let firstName = get("firstName");
    let lastName = get("lastName");
    if (!firstName && !lastName && hasFull) {
      const full = get("fullName");
      // Split "Last, First" or "First Last"
      if (full.includes(",")) {
        const [l, f] = full.split(",", 2);
        lastName = (l ?? "").trim();
        firstName = (f ?? "").trim();
      } else {
        const parts = full.split(/\s+/);
        firstName = parts[0] ?? "";
        lastName = parts.slice(1).join(" ");
      }
    }
    if (!firstName || !lastName) {
      errors.push({
        rowIndex: i - 1,
        message: "Missing first or last name.",
      });
      continue;
    }

    rows.push({
      rowIndex: i - 1,
      firstName,
      lastName,
      jerseyNumber: parseJersey(get("jerseyNumber")),
      positions: parsePositions(get("positions")),
      bats: parseHandedness(get("bats")),
      throws: parseHandedness(get("throws")) as "L" | "R" | null,
      grade: parseGrade(get("grade")),
      graduationYear: parseGraduationYear(get("graduationYear")),
      raw,
    });
  }

  return { rows, errors, recognizedColumns, unrecognizedColumns };
}
