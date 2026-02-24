

# Fix Session Handling for Imported Data

## Problem

Imported data currently gets inserted with `session_id = null`. This causes two issues:

1. **Dashboard hides imported scores** -- When a specific session is selected (which happens automatically if today's session exists), evaluations without a `session_id` are filtered out entirely.
2. **Player Detail shows "unsorted"** -- Evaluations without a session appear under an "unsorted" group, which is confusing for coaches.

The fix has two parts: let coaches assign a session during import, and make the "All Sessions" view properly include session-less data.

## Changes

### 1. Add session picker to the Import wizard (`src/components/DataImport.tsx`)

- Add a session selector dropdown on the **preview step** (right before the Import button), letting the coach pick which session this data belongs to -- or leave it as "No session".
- When importing, include the selected `session_id` in every evaluation insert (currently the `session_id` field is omitted entirely).
- Also offer a "Create New Session" option inline (using the existing `createSession` from `SessionContext`) so coaches can create one on the fly if needed.

### 2. Fix Dashboard filtering to include session-less evals (`src/pages/Dashboard.tsx`)

- When the session filter is set to "All", the query already works (no filter applied).
- No code change needed here -- the real fix is ensuring imported data gets a session in step 1.

### 3. Improve PlayerDetail "unsorted" label (`src/pages/PlayerDetail.tsx`)

- Rename the "unsorted" group to "Imported / Unassigned" so it is clear where these scores came from.
- Show it in a visually distinct way so coaches understand why it is separate.

### 4. Bulk-assign session to existing orphaned evaluations

- Add a small utility on the PlayerDetail page (or a one-time option) that lets coaches assign orphaned evaluations (those with `session_id = null`) to an existing session. This cleans up data that was already imported before this fix.

## Technical Details

### `src/components/DataImport.tsx`

- Import `useSession` from `SessionContext`.
- Add state: `const [importSessionId, setImportSessionId] = useState<string>("")`.
- In the preview step, render a session picker `Select` component with options from `sessions` plus "No Session" and "+ Create Session".
- In `handleImport`, add `session_id: importSessionId || null` to each evaluation object in the `evals` array (line ~495-503).

### `src/pages/PlayerDetail.tsx`

- Change the label for the "unsorted" key from raw display to "Imported / Unassigned".
- Add a small "Assign to Session" dropdown next to the "Imported / Unassigned" header that bulk-updates all null-session evaluations for that player to a chosen session via:
  ```sql
  UPDATE evaluations SET session_id = '<chosen>' 
  WHERE player_id = '<id>' AND session_id IS NULL
  ```

### `src/contexts/SessionContext.tsx`

- No changes needed -- the existing `sessions` list and `createSession` function are sufficient.

## Summary of File Changes

| File | Change |
|---|---|
| `src/components/DataImport.tsx` | Add session picker on preview step; include `session_id` in evaluation inserts |
| `src/pages/PlayerDetail.tsx` | Rename "unsorted" to "Imported / Unassigned"; add bulk-assign-to-session action |

## No Database Changes Required

The `evaluations.session_id` column already exists and is nullable. No schema changes needed.
