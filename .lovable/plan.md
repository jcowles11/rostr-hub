

# Handle All Messy Spreadsheet Formats

## Problem

The current import system only handles one format: wide tables with clean numeric values and attempt columns ending in `_N`. The 4 uploaded CSVs reveal formats that will fail:

1. **Units embedded in cells** -- `85.4 mph`, `6.72 s` mixed with bare numbers
2. **Long/tidy format** -- One row per measurement (`metric_name`, `trial`, `value` columns) instead of one row per player
3. **Metadata header rows** -- Non-data rows before the actual table, European comma-decimals (`"8,03"`), extra columns like Team/Email
4. **Packed trials in single cells** -- Multiple attempts in one cell (`8.03/6.72`, `74.8/85.4/79.7/89.6/73.9 mph`), dashes and "NA" as missing

## Solution: Pre-Processing Pipeline

Add a data cleaning pipeline that normalizes any format into the existing wide-format structure before the current mapping UI takes over. The coach sees the same simple wizard -- the messy handling is invisible.

## Changes

### 1. New utility functions in `src/lib/importUtils.ts`

- **`stripUnitsFromValue(val)`** -- Remove trailing "mph", "s", "sec", etc. and parse the number. Handle "N/A", "NA", "--", whitespace as null.
- **`fixEuropeanDecimal(val)`** -- If a quoted value uses commas as decimal separators (e.g. `"8,03"`), convert to `8.03`. Only applies when the value has exactly one comma and no periods.
- **`detectHeaderRow(rawRows)`** -- Scan the first ~15 rows to find the actual column header row by checking which row has the most non-empty string values that look like headers (not numbers, not metadata). Skips metadata rows like "Tryout Name, Rocky Mountain Showcase" and separator rows like "--- DATA BELOW ---".
- **`isLongFormat(headers)`** -- Returns true if headers contain columns matching `metric_name`/`trial`/`value` patterns (indicating a tidy/long dataset).
- **`pivotLongToWide(rows, headers)`** -- Converts long-format data to wide format: groups by player, creates columns like `MetricName_1`, `MetricName_2` etc. per trial number.
- **`expandPackedCells(rows, headers)`** -- Detects columns where values contain `/` or `,` separated numbers (e.g. `8.03/6.72`). Splits them into separate attempt columns (e.g. `60yd_1`, `60yd_2`), stripping units from each part.
- **`cleanAllValues(rows)`** -- Runs `fixEuropeanDecimal` and `stripUnitsFromValue` on every cell.

### 2. Updated `parseFile` in `src/components/DataImport.tsx`

Insert a pre-processing step between raw parsing and the existing `processData` function:

```text
Raw CSV/Excel
    |
    v
detectHeaderRow() -- skip metadata rows, find real headers
    |
    v
isLongFormat()? -- if yes, pivotLongToWide()
    |
    v
expandPackedCells() -- split multi-value cells into attempt columns
    |
    v
cleanAllValues() -- strip units, fix European decimals
    |
    v
processData() -- existing flow (guessPlayerColumns, groupAttemptColumns, etc.)
```

The coach never sees this pipeline -- they just get the familiar mapping wizard with correctly detected columns.

### 3. Smarter value parsing in `buildMatchedRows`

Currently uses raw `parseFloat(row[col])`. Update to use `stripUnitsFromValue()` so any residual unit text in cells is handled at parse time too (defense in depth).

### 4. Handle B/T format variations

The `Bats R / Throws R` format in these files needs to be recognized. Update `isPlayerInfoColumn` to also match `bat_throw`, `bat throw`, and the `splitBatsThrows` function to handle `Bats R / Throws R` and `Bats S / Throws L` formats (not just `R/R`).

## Technical Details

### `src/lib/importUtils.ts` -- New functions

```typescript
// Strip units and parse number from messy cell values
export function stripUnitsFromValue(raw: string): number | null {
  if (!raw) return null;
  let val = raw.trim();
  // Handle missing-value markers
  if (/^(n\/?a|na|--|-|—|\.+|\s*)$/i.test(val)) return null;
  // Fix European decimal (single comma, no period)
  if (/^\d+,\d+$/.test(val)) val = val.replace(",", ".");
  // Strip trailing unit words
  val = val.replace(/\s*(mph|sec|s|ft|in|inches|lbs|kg|m\/s|rpm)\.?\s*$/i, "").trim();
  const num = parseFloat(val);
  return isFinite(num) ? num : null;
}

// Detect actual header row in data with metadata preamble
export function detectHeaderRow(rawRows: string[][]): number {
  // Score each row: headers have many non-numeric, non-empty cells
  // Return index of best candidate (usually first row with 5+ string cells)
}

// Check if this is a long/tidy format
export function isLongFormat(headers: string[]): boolean {
  const norms = headers.map(normalizeHeader);
  const hasMetricName = norms.some(n => 
    ["metric name", "metricname", "metric", "drill", "test", "event"].includes(n));
  const hasTrial = norms.some(n => 
    ["trial", "attempt", "rep", "try"].includes(n));
  const hasValue = norms.some(n => 
    ["value", "score", "result", "measurement"].includes(n));
  return hasMetricName && hasValue;
}

// Pivot long format to wide
export function pivotLongToWide(rows, headers): { headers: string[], rows: Record<string,string>[] }

// Expand packed multi-value cells
export function expandPackedCells(rows, headers): { headers: string[], rows: Record<string,string>[] }
```

### `src/components/DataImport.tsx` -- Updated parseFile processData

The `processData` function gains a pre-processing pipeline that calls the new utilities in sequence. The rest of the component (identify step, map_metrics step, preview, import) stays the same.

### `src/lib/importUtils.ts` -- Updated splitBatsThrows

Handle verbose formats like `Bats R / Throws R`:
```typescript
export function splitBatsThrows(val: string): { bats: string; throws: string } {
  const trimmed = val.trim().toUpperCase();
  if (!trimmed) return { bats: "", throws: "" };
  // Handle "Bats R / Throws R" format
  const verboseMatch = trimmed.match(/BATS?\s+([RLSB])\s*[\/\\|,]\s*THROWS?\s+([RLSB])/i);
  if (verboseMatch) return { bats: verboseMatch[1], throws: verboseMatch[2] };
  // Existing short format handling (R/R, L/R, etc.)
  const parts = trimmed.split(/[\/\-\\|,]/);
  if (parts.length >= 2) {
    return { bats: parts[0].trim().substring(0, 1), throws: parts[1].trim().substring(0, 1) };
  }
  return { bats: "", throws: "" };
}
```

## What Each Messy File Tests

| File | Key challenges handled |
|---|---|
| `messy_wide_units_in_cells.csv` | Units in cells (`85.4 mph`), `N/A`, mixed bare/unit numbers, verbose B/T |
| `messy_long_tidy_measurements.csv` | Completely different row structure, auto-pivot to wide, `NA` text, typos like `7.two` |
| `messy_metadata_then_table.csv` | Metadata preamble rows, separator row, European decimals (`"8,03"`), extra columns (Team, Email) |
| `messy_packed_trials_single_cells.csv` | Multiple attempts in one cell (`8.03/6.72`), em-dash missing values, comma-separated values |

## No Database Changes Required

All changes are in the front-end pre-processing pipeline. The existing database schema (players, evaluations, metrics) is unchanged.

