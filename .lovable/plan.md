

# Organize "Unassigned" Scores and Improve Metric Display

## Problem
Scores and metrics that aren't tied to a specific tryout session show up as "Unassigned" on player profiles -- both on the coach's backend view and the public-facing profile. This looks unprofessional, especially for evaluator-submitted data that comes from showcases, camps, or independent evaluations and naturally won't belong to a tryout session.

## Solution

### 1. Rename "Unassigned" to smarter labels on the coach view

On the **PlayerDetail** page (coach side), replace the generic "Unassigned" label with context-aware labeling:
- Rename "Unassigned" to **"General Scores"** -- a clean, neutral label for scores entered outside of a formal session
- Add a subtle subtitle: "Scores not tied to a session"

This is a small but meaningful UX improvement that removes the "something is wrong" feel of "Unassigned."

### 2. Organize public profile metrics by source

On the **PublicProfile** page, instead of dumping all metrics into one flat list, group them into two clear sections:

- **Program Metrics** -- scores from the player's coaching staff, with the program name as attribution (e.g., "Verified by Lincoln HS Baseball")
- **Showcase / Independent Evaluations** -- scores from verified evaluators, grouped by evaluator or event, showing the evaluator name, organization, event name, and date

This gives scouts and recruiters a clear picture of where each data point came from.

### 3. Add event context to evaluator entries on coach view

On the **PlayerDetail** page, fetch and display evaluator entries alongside program scores so coaches get the full picture of a player's verified data -- not just their own scores. These will appear in a separate collapsible section called **"External Evaluations"** below the session-grouped scores.

## Technical Details

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/PlayerDetail.tsx` | Rename "Unassigned" to "General Scores" with subtitle. Add new collapsible "External Evaluations" section that fetches from `evaluator_entries` for the player. |
| `src/pages/PublicProfile.tsx` | Split the flat "Verified Metrics" list into two grouped sections: "Program Metrics" and "Showcase Evaluations." Group evaluator entries by evaluator/event for cleaner display. |

### No database changes needed

All the data already exists:
- `evaluations` table has `session_id` (nullable) for program scores
- `evaluator_entries` table has `event_name`, `event_date`, `evaluator_id` with evaluator attribution
- The `get_public_profile` RPC already returns both `metrics` and `evaluator_metrics` separately

### PlayerDetail.tsx changes
- Line 488: Change `"Unassigned"` to `"General Scores"`
- Add a new section after the session-grouped scores that queries `evaluator_entries` joined with `evaluators` for this player
- Display each external evaluation with: metric name, value, evaluator name, organization, event name, and date
- Make this section collapsible like the existing session sections

### PublicProfile.tsx changes
- Instead of combining `metrics` and `evaluator_metrics` into one `allMetrics` array, render them as two separate card sections
- **"Program Metrics"** card: shows aggregated program scores with the program name badge
- **"Showcase & Evaluator Data"** card: groups evaluator entries by evaluator (or event if available), each with clear attribution showing evaluator name, organization, and event context
- If either section is empty, it simply doesn't render (no empty state needed)

