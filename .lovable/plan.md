

# Smarter Session Management

## The Problem
Right now, sessions live *only* on the Score Entry tab. They're needed there for data entry, but the rest of the app (Dashboard, Player Detail) ignores sessions entirely -- showing all scores flattened together with no way to compare across sessions. Switching sessions on the scoring page feels buried and disconnected from the bigger picture.

## The Solution: Three Changes

### 1. Global Session Context in the App Header
Move the "active session" concept out of Score Entry and into a shared context that lives in the app header bar (next to the program switcher). This way:

- The active session is visible and switchable from any tab
- Score Entry automatically uses it (no separate dropdown needed there)
- Dashboard and Player Detail can optionally filter by it
- Creating a new session can happen from the header too

The header will show a small session chip (e.g., "Day 2 Tryouts - Feb 24") with a dropdown to switch or create sessions. An "All Sessions" option lets coaches see the full picture.

### 2. Session-Aware Dashboard
The Dashboard currently shows all scores across all sessions mashed together. With the global session context:

- When a specific session is selected: Dashboard shows only that session's scores and rankings
- When "All Sessions" is selected: Dashboard shows the aggregated best/average across all sessions (current behavior)
- This lets coaches answer "who performed best TODAY?" vs "who performs best OVERALL?"

### 3. Session-Grouped Player Detail
The Player Detail page currently shows a flat list of all evaluations. Update it to:

- Group scores by session, with session name and date as section headers
- Show a summary row at the top with the aggregated (best/average) value across all sessions
- This gives coaches the progression view they want (e.g., "60 yard dash: 7.5s in January, 7.2s in February")

## Technical Plan

### New File: `src/contexts/SessionContext.tsx`
A React context that:
- Fetches all sessions for the current program
- Stores `selectedSessionId` (or `"all"` for no filter)
- Auto-selects today's session if one exists, otherwise "all"
- Provides `createSession()` and `setSession()` functions
- Is consumed by Score Entry, Dashboard, and Player Detail

### Modified Files

| File | Change |
|------|--------|
| `src/contexts/SessionContext.tsx` | **New** -- session state, fetch, create, switch |
| `src/components/AppLayout.tsx` | Add session chip/dropdown in the header bar, next to program switcher |
| `src/pages/ScoreEntry.tsx` | Remove local session state/UI. Consume from `SessionContext`. Keep the scoring logic identical. |
| `src/pages/Dashboard.tsx` | Add session filtering to the evaluations query. When a session is selected, only show that session's data. When "all", show aggregated data (current behavior). |
| `src/pages/PlayerDetail.tsx` | Group evaluations by session with headers. Show an "all sessions" aggregate summary at top. |
| `src/App.tsx` | Wrap the coach routes with `SessionProvider` |

### Session Context Shape

```text
SessionContext
  sessions: TryoutSession[]
  selectedSessionId: string | "all"
  setSession(id: string | "all")
  createSession(name: string): Promise<TryoutSession>
  currentSession: TryoutSession | null
```

### Header Layout Change

```text
Before:
  [Logo]  [Program Name v]  [spacer]

After:
  [Logo]  [Program Name v]  [Session chip v]
```

The session chip is compact -- just shows the session name (truncated) with a dropdown arrow. Tapping it opens a dropdown with all sessions, an "All Sessions" option, and a "+ New Session" action.

### Dashboard Query Change
When `selectedSessionId !== "all"`, the evaluations query adds `.eq("session_id", selectedSessionId)`. The rest of the aggregation logic stays the same -- it just operates on a filtered set.

### Player Detail Grouping
Fetch evaluations with `session_id` included. Join with `tryout_sessions` to get names/dates. Render as collapsible sections per session, newest first, with the aggregate "best overall" shown prominently at the top of each metric card.

### No Database Changes Required
The `tryout_sessions` table and `evaluations.session_id` column already exist. This is purely a frontend restructuring.

