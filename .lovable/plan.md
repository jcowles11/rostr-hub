

# Fix: Session-Scoped Score Entry (Stop Overwriting)

## Problem
The Score Entry page currently matches existing evaluations by `(player_id, metric_id, attempt_number, coach_id)`. When a coach enters a score for a player who already has one for that metric/attempt, it **overwrites** instead of creating a new entry. This prevents coaches from recording scores across multiple tryout sessions.

## Root Cause
The `evaluations` table already has a `session_id` column, but the Score Entry page never uses it. Without session scoping, there's no way to distinguish "60 yard dash attempt 1 from Day 1" vs "60 yard dash attempt 1 from Day 2."

## Solution
Make the Score Entry page session-aware:

1. **Add a session selector** at the top of the Score Entry page (above the metric selector)
2. **Require a session** before scoring — coach either picks an existing session or creates a new one inline
3. **Scope all queries and inserts to the selected session** — the "existing eval" check uses `session_id`, so scores from different sessions never collide
4. **Always insert new rows** for new sessions, only overwrite within the same session+attempt

## How It Works For Coaches

1. Coach opens Score Entry
2. Picks today's session (e.g., "Day 2 Tryouts") or taps "+ New Session" to create one
3. Selects a metric, starts scoring players
4. If a player already has a score for that metric+attempt **in this session**, it shows "will overwrite" (intentional correction)
5. Scores from previous sessions are untouched — they remain as separate records

## Technical Changes

| File | Change |
|------|--------|
| `src/pages/ScoreEntry.tsx` | Add session state, session selector UI, session creation, scope existing-eval queries by session_id, include session_id in inserts |

### Detailed Changes in ScoreEntry.tsx

1. **New state**: `selectedSession` (uuid), `sessions` (list from `tryout_sessions`), `showNewSession` (boolean for inline creation)

2. **Fetch sessions** on mount — query `tryout_sessions` for the coach's program, ordered by date descending. Auto-select today's session if one exists.

3. **Session selector UI** — a dropdown above the metric selector showing available sessions with a "+ New Session" option. Creating a new session requires just a name (date defaults to today).

4. **Scope existing eval query** (line 67-76) — add `.eq("session_id", selectedSession)` so it only finds evals from the current session.

5. **Include session_id in insert** (line 120-127) — add `session_id: selectedSession` to the evaluation insert.

6. **Overwrite check** (line 112) — `getPlayerAttemptEval` already scoped by the filtered `existingEvals`, which is now session-scoped. So overwriting only happens within the same session, which is the correct behavior (fixing a typo).

7. **Show previous session scores** — below the scoring card, show a small summary of the player's scores from other sessions for this metric (read-only context so the coach can see progression).

### UI Layout (top to bottom)

```text
+----------------------------------+
| Score Entry              [Station Mode] |
+----------------------------------+
| Session: [Day 2 Tryouts v] [+ New] |
+----------------------------------+
| Metric: [60 Yard Dash (sec) v]  |
+----------------------------------+
| Search players...        [A-Z]  |
+----------------------------------+
| [Active player scoring card]    |
|   Previous: 7.12s (Day 1)       |
+----------------------------------+
| Player list / Recent scores     |
+----------------------------------+
```

### Key Behavior Changes

- Scores are always tied to a session — no more orphaned `session_id = null` evaluations
- Same player + same metric + same attempt in different sessions = separate rows (no overwrite)
- Same player + same metric + same attempt in the SAME session = overwrite (intentional correction)
- Player list attempt dots show completion for the **current session** only
- Previous session scores shown as read-only context below the scoring card

