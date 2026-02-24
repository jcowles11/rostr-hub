

# Fix Spreadsheet Import: Smarter Column Detection

## Problems Identified

1. **B/T column leaking into metrics** -- The `mappedMetricHeaders` blocklist on the "Map Metrics" step filters out known player-info columns, but "b/t", "bats/throws" etc. are missing from this list. So the B/T column shows up as a mappable metric column.

2. **Over-aggressive metric auto-matching** -- `guessMetricColumns` uses bidirectional `includes()` matching (`hLower.includes(mLower) || mLower.includes(hLower)`). This means a column like "Velocity" could match "Arm Velocity (IF)" and vice versa, or unrelated partial matches could occur. Only columns that actually contain numeric data should be candidates.

3. **Blocklist approach is fragile** -- The current approach maintains a hardcoded list of "skip" terms. Any column name a coach invents that isn't in the list will show up as a metric candidate. A better approach: show ALL non-name columns in the metric mapping step but default them to "Skip", and use smarter auto-matching that only matches when confident.

4. **No data-sniffing** -- The system doesn't look at actual cell values. A column full of "R/R", "L/R" values is obviously not a numeric metric. Checking whether a column has mostly numeric values would help auto-categorize.

## Plan

### 1. Add a normalized column matching utility

Create a `normalizeHeader(name)` function that lowercases, strips accents, collapses whitespace/underscores, and trims. Use it everywhere instead of raw `toLowerCase()`.

### 2. Expand the player-info blocklist with data sniffing

Replace the static blocklist with a smarter `isPlayerInfoColumn(header, rows)` function that:
- Checks against an expanded list of known player-info terms (including "b/t", "bats/throws", "bat/throw", "ht", "height", "weight", "wt", "age", "dob", "birthday", "email", "phone", "class", "team", "school", "city", "state", "zip", "address", "parent", "guardian")
- Also checks the actual data: if fewer than 30% of values in a column are parseable as numbers, it's probably not a metric

### 3. Improve metric auto-matching confidence

Change `guessMetricColumns` to use stricter matching:
- Exact match (normalized): highest confidence
- Header equals metric name after stripping units like "(mph)", "(sec)": good match
- Only use `includes` as a fallback when the header is short and fully contained in the metric name (not the reverse)
- Never auto-match if the column fails the numeric data sniff

### 4. Show all remaining columns in metric mapping step

Instead of pre-filtering `mappedMetricHeaders`, show ALL columns that aren't mapped as player name columns. Columns detected as player-info will default to "Skip" but remain visible so coaches can override. This ensures nothing gets silently hidden.

### 5. Apply the same improvements to RosterUpload

The `guessMapping` function in RosterUpload already handles B/T well, but will benefit from the normalized matching utility for consistency.

## Technical Details

### File: `src/components/DataImport.tsx`

**New helper functions:**

```typescript
function normalizeHeader(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}

function isNumericColumn(rows: Record<string, string>[], header: string): boolean {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 20);
  const numericCount = sample.filter(r => {
    const val = (r[header] || "").trim();
    return val !== "" && !isNaN(parseFloat(val));
  }).length;
  const nonEmptyCount = sample.filter(r => (r[header] || "").trim() !== "").length;
  return nonEmptyCount > 0 && (numericCount / nonEmptyCount) >= 0.5;
}

const PLAYER_INFO_TERMS = [
  "first name", "last name", "first_name", "last_name", "firstname", "lastname",
  "name", "first", "last", "surname", "player name", "player_name", "full name",
  "full_name", "fullname", "athlete",
  "grade", "year", "class",
  "position", "pos",
  "jersey", "number", "#", "num",
  "bats", "throws", "b/t", "bats/throws", "bat/throw", "bats-throws",
  "ht", "height", "wt", "weight", "age", "dob", "birthday",
  "email", "phone", "team", "school", "city", "state", "zip", "address",
  "parent", "guardian", "notes", "comment"
];

function isPlayerInfoColumn(header: string): boolean {
  const norm = normalizeHeader(header);
  return PLAYER_INFO_TERMS.some(t => norm === t || norm === t.replace(/[\s_]/g, ""));
}
```

**Changes to `guessMetricColumns`:**
- Use `normalizeHeader` for matching
- Only auto-match columns that pass `isNumericColumn` check
- Use stricter matching: exact normalized match or header fully contained in metric name (not reverse)

**Changes to `mappedMetricHeaders` (line 233-238):**
- Replace the blocklist filter with: show all columns except the ones currently mapped as player name columns (first_name, last_name, player_name)
- Each column gets a default mapping: auto-matched metric if confident, "Skip" otherwise
- This means coaches see every column and can manually map any column to any metric

**Changes to `guessPlayerColumns`:**
- Use `normalizeHeader` for more robust matching

### File: `src/components/RosterUpload.tsx`

- Use the same `normalizeHeader` function for `guessMapping`
- Expand the B/T detection terms to match more variations

