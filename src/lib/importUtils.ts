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
  "bat throw", "bat_throw",
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
    // Use stripUnitsFromValue for smarter detection
    if (stripUnitsFromValue(val) !== null) {
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
  // Handle verbose "Bats R / Throws R" format
  const verboseMatch = trimmed.match(/BATS?\s+([RLSB])\s*[\/\\|,]\s*THROWS?\s+([RLSB])/);
  if (verboseMatch) return { bats: verboseMatch[1], throws: verboseMatch[2] };
  // Existing short format handling (R/R, L/R, etc.)
  const parts = trimmed.split(/[\/\-\\|,]/);
  if (parts.length >= 2) {
    return { bats: parts[0].trim().substring(0, 1), throws: parts[1].trim().substring(0, 1) };
  }
  return { bats: "", throws: "" };
}

// ─── Pre-processing pipeline utilities ────────────────────────────────────

/**
 * Strip units from a cell value and parse as number. Returns null for missing/invalid values.
 */
export function stripUnitsFromValue(raw: string): number | null {
  if (!raw) return null;
  let val = raw.trim();
  if (!val) return null;
  // Handle missing-value markers
  if (/^(n\/?a|na|none|--+|-|—|\.+)$/i.test(val)) return null;
  // Fix European decimal (single comma, no period) e.g. "8,03"
  if (/^\d+,\d+$/.test(val)) val = val.replace(",", ".");
  // Strip trailing unit words
  val = val.replace(/\s*(mph|sec|s|ft|in|inches|lbs|kg|m\/s|rpm|")\s*$/i, "").trim();
  // Strip leading unit/currency symbols
  val = val.replace(/^[$€£]\s*/, "").trim();
  const num = parseFloat(val);
  return isFinite(num) ? num : null;
}

/**
 * Fix European decimal in a string value (returns string, not parsed).
 * Only converts if there is exactly one comma and no periods. E.g. "8,03" → "8.03"
 */
export function fixEuropeanDecimal(val: string): string {
  const trimmed = val.trim();
  if (/^\d+,\d+$/.test(trimmed)) {
    return trimmed.replace(",", ".");
  }
  return trimmed;
}

/**
 * Detect the header row index in raw 2D array data. Skips metadata preamble rows.
 * Scores each row by: count of non-empty, non-numeric string cells.
 * The first row with a high score (≥3 string cells) is likely the header.
 */
export function detectHeaderRow(rawRows: string[][]): number {
  if (rawRows.length === 0) return 0;
  const scanLimit = Math.min(rawRows.length, 15);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    // Skip separator rows like "--- DATA BELOW ---"
    const joined = row.join("").trim();
    if (/^[-=\s*#]+$/.test(joined)) continue;

    let stringCells = 0;
    for (const cell of row) {
      const trimmed = (cell || "").trim();
      if (!trimmed) continue;
      // If it looks like a number, it's data not a header
      if (/^-?\d+([.,]\d+)?$/.test(trimmed)) continue;
      // If it looks like a number with units, it's data
      if (/^\d+(\.\d+)?\s*(mph|s|sec|ft|in|lbs)$/i.test(trimmed)) continue;
      stringCells++;
    }

    // The header row is typically the first row with many string cells
    if (stringCells > bestScore) {
      bestScore = stringCells;
      bestIdx = i;
    }

    // If we found a row with ≥4 string cells, it's almost certainly the header
    if (stringCells >= 4) return i;
  }

  return bestIdx;
}

/**
 * Check if headers indicate long/tidy format (one measurement per row).
 */
export function isLongFormat(headers: string[]): boolean {
  const norms = headers.map(normalizeHeader);
  const hasMetricName = norms.some((n) =>
    ["metric name", "metricname", "metric", "drill", "test", "event"].includes(n)
  );
  const hasValue = norms.some((n) =>
    ["value", "score", "result", "measurement"].includes(n)
  );
  // Need at least metric name + value columns, and a player identifier
  const hasPlayer = norms.some((n) =>
    ["player", "player name", "playername", "name", "athlete", "full name", "fullname",
     "first name", "firstname", "last name", "lastname"].includes(n)
  );
  return hasMetricName && hasValue && hasPlayer;
}

/**
 * Find a column name from headers by checking normalized matches against terms.
 */
function findColumn(headers: string[], terms: string[]): string | null {
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (terms.includes(norm)) return h;
  }
  return null;
}

/**
 * Pivot long/tidy format to wide format (one row per player).
 */
export function pivotLongToWide(
  rows: Record<string, string>[],
  headers: string[]
): { headers: string[]; rows: Record<string, string>[] } {
  // Find key columns
  const playerCol =
    findColumn(headers, ["player name", "playername", "name", "athlete", "full name", "fullname", "player"]);
  const firstNameCol = findColumn(headers, ["first name", "firstname", "first"]);
  const lastNameCol = findColumn(headers, ["last name", "lastname", "last", "surname"]);
  const metricCol =
    findColumn(headers, ["metric name", "metricname", "metric", "drill", "test", "event"]);
  const valueCol = findColumn(headers, ["value", "score", "result", "measurement"]);
  const trialCol = findColumn(headers, ["trial", "attempt", "rep", "try"]);

  if (!metricCol || !valueCol) {
    // Can't pivot without these
    return { headers, rows };
  }

  // Determine player key function
  const getPlayerKey = (row: Record<string, string>): string => {
    if (firstNameCol && lastNameCol) {
      return `${(row[firstNameCol] || "").trim()}|||${(row[lastNameCol] || "").trim()}`.toLowerCase();
    }
    if (playerCol) return (row[playerCol] || "").trim().toLowerCase();
    return "";
  };

  // Collect extra info columns (not metric/value/trial)
  const metaColumns = new Set([metricCol, valueCol, trialCol].filter(Boolean) as string[]);

  // Group by player
  const playerData = new Map<string, { info: Record<string, string>; metrics: Map<string, string[]> }>();

  for (const row of rows) {
    const key = getPlayerKey(row);
    if (!key) continue;

    if (!playerData.has(key)) {
      // Copy non-metric columns as player info
      const info: Record<string, string> = {};
      for (const h of headers) {
        if (!metaColumns.has(h)) {
          info[h] = (row[h] || "").trim();
        }
      }
      playerData.set(key, { info, metrics: new Map() });
    }

    const metricName = (row[metricCol] || "").trim();
    if (!metricName) continue;

    const value = (row[valueCol] || "").trim();
    const pd = playerData.get(key)!;
    if (!pd.metrics.has(metricName)) pd.metrics.set(metricName, []);
    pd.metrics.get(metricName)!.push(value);
  }

  // Build wide headers
  const infoHeaders = headers.filter((h) => !metaColumns.has(h));
  const allMetricNames = new Set<string>();
  let maxTrials = new Map<string, number>();
  for (const pd of playerData.values()) {
    for (const [metric, values] of pd.metrics) {
      allMetricNames.add(metric);
      maxTrials.set(metric, Math.max(maxTrials.get(metric) || 0, values.length));
    }
  }

  const metricHeaders: string[] = [];
  const sortedMetrics = [...allMetricNames].sort();
  for (const metric of sortedMetrics) {
    const count = maxTrials.get(metric) || 1;
    if (count === 1) {
      metricHeaders.push(metric);
    } else {
      for (let i = 1; i <= count; i++) {
        metricHeaders.push(`${metric}_${i}`);
      }
    }
  }

  const wideHeaders = [...infoHeaders, ...metricHeaders];
  const wideRows: Record<string, string>[] = [];

  for (const pd of playerData.values()) {
    const row: Record<string, string> = { ...pd.info };
    for (const metric of sortedMetrics) {
      const values = pd.metrics.get(metric) || [];
      const count = maxTrials.get(metric) || 1;
      if (count === 1) {
        row[metric] = values[0] || "";
      } else {
        for (let i = 0; i < count; i++) {
          row[`${metric}_${i + 1}`] = values[i] || "";
        }
      }
    }
    wideRows.push(row);
  }

  return { headers: wideHeaders, rows: wideRows };
}

/**
 * Detect columns with packed multi-value cells (e.g. "8.03/6.72" or "74.8, 85.4, 79.7")
 * and expand them into separate attempt columns.
 */
export function expandPackedCells(
  rows: Record<string, string>[],
  headers: string[]
): { headers: string[]; rows: Record<string, string>[] } {
  if (rows.length === 0) return { headers, rows };

  // Detect which columns have packed values by sampling
  const packedCols: { header: string; maxParts: number }[] = [];
  const sample = rows.slice(0, 20);

  for (const header of headers) {
    // Skip columns that look like player info
    if (isPlayerInfoColumn(header)) continue;

    let packedCount = 0;
    let maxParts = 1;

    for (const row of sample) {
      const val = (row[header] || "").trim();
      if (!val) continue;

      // Check for slash-separated values (not dates like 01/15/2024)
      const slashParts = val.split("/");
      if (slashParts.length >= 2 && slashParts.every((p) => {
        const cleaned = p.trim().replace(/\s*(mph|s|sec|ft|in|lbs|rpm)\s*$/i, "").trim();
        return cleaned === "" || !isNaN(parseFloat(cleaned));
      })) {
        packedCount++;
        maxParts = Math.max(maxParts, slashParts.length);
        continue;
      }
    }

    // If ≥30% of non-empty sample rows are packed, expand this column
    if (packedCount >= Math.max(2, sample.filter((r) => (r[header] || "").trim()).length * 0.3)) {
      packedCols.push({ header, maxParts });
    }
  }

  if (packedCols.length === 0) return { headers, rows };

  // Build new headers and rows
  const newHeaders: string[] = [];
  const expansionMap = new Map<string, string[]>();

  for (const h of headers) {
    const packed = packedCols.find((p) => p.header === h);
    if (packed) {
      const expandedNames: string[] = [];
      for (let i = 1; i <= packed.maxParts; i++) {
        const name = `${h}_${i}`;
        expandedNames.push(name);
        newHeaders.push(name);
      }
      expansionMap.set(h, expandedNames);
    } else {
      newHeaders.push(h);
    }
  }

  const newRows = rows.map((row) => {
    const newRow: Record<string, string> = {};
    for (const h of headers) {
      if (expansionMap.has(h)) {
        const val = (row[h] || "").trim();
        const parts = val.split("/").map((p) => {
          let cleaned = p.trim().replace(/\s*(mph|s|sec|ft|in|lbs|rpm)\s*$/i, "").trim();
          // Handle missing markers within packed cells
          if (/^(n\/?a|na|--+|-|—)$/i.test(cleaned)) return "";
          return cleaned;
        });
        const expandedNames = expansionMap.get(h)!;
        for (let i = 0; i < expandedNames.length; i++) {
          newRow[expandedNames[i]] = parts[i] || "";
        }
      } else {
        newRow[h] = row[h] || "";
      }
    }
    return newRow;
  });

  return { headers: newHeaders, rows: newRows };
}

/**
 * Clean all cell values: fix European decimals and strip units (returns string values).
 */
export function cleanAllValues(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.map((row) => {
    const cleaned: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      if (isPlayerInfoColumn(key)) {
        cleaned[key] = val; // Don't modify player info cells
      } else {
        let v = fixEuropeanDecimal(val || "");
        // Strip unit text but keep as string for downstream processing
        const num = stripUnitsFromValue(v);
        cleaned[key] = num !== null ? String(num) : val;
      }
    }
    return cleaned;
  });
}

/**
 * Full pre-processing pipeline: takes raw 2D array from CSV/Excel parse,
 * returns clean {headers, rows} ready for the existing processData flow.
 */
export function preprocessRawData(rawRows: string[][]): {
  headers: string[];
  rows: Record<string, string>[];
} {
  if (rawRows.length === 0) return { headers: [], rows: [] };

  // 1. Detect header row (skip metadata preamble)
  const headerIdx = detectHeaderRow(rawRows);
  const headerRow = rawRows[headerIdx];
  const headers = headerRow.map((h) => (h || "").trim()).filter(Boolean);

  // 2. Convert remaining rows to Record<string, string>
  const dataRows = rawRows.slice(headerIdx + 1);
  let records: Record<string, string>[] = dataRows
    .filter((row) => row.some((cell) => (cell || "").trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = (row[i] || "").trim();
      });
      return record;
    });

  // 3. Check for long/tidy format and pivot
  if (isLongFormat(headers)) {
    const pivoted = pivotLongToWide(records, headers);
    // Clean and return pivoted data
    return {
      headers: pivoted.headers,
      rows: cleanAllValues(pivoted.rows),
    };
  }

  // 4. Expand packed multi-value cells
  let currentHeaders = headers;
  const expanded = expandPackedCells(records, currentHeaders);
  currentHeaders = expanded.headers;
  records = expanded.rows;

  // 5. Clean all values (fix decimals, strip units)
  records = cleanAllValues(records);

  return { headers: currentHeaders, rows: records };
}

// ─── Column grouping ──────────────────────────────────────────────────────

export interface ColumnGroup {
  displayName: string;
  columns: string[];
}

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

  for (const [baseName, columns] of groupMap) {
    columns.sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)$/)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)$/)?.[1] || "0");
      return aNum - bNum;
    });
    const displayName = baseName.replace(/[_]+/g, " ").trim();
    groups.push({ displayName, columns });
  }

  for (const header of soloColumns) {
    const displayName = header.replace(/[_]+/g, " ").trim();
    groups.push({ displayName, columns: [header] });
  }

  return groups;
}
