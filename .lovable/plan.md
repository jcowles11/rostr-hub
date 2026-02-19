

# Composite Score: Percentile-Based Ranking

## The Problem
The "All Metrics" composite currently averages raw values (e.g., a 4.5-second 60-yard dash + 78 mph velo + a 55 on 20-80 scale = nonsensical average). Different units and scales make raw averaging meaningless.

## The Solution: Percentile Ranking Within the Cohort
For each metric, rank every player against the other tryout participants and convert to a 0-100 percentile. Then average percentiles across all metrics for a single composite score.

**How it works:**
1. For each metric, collect all players' aggregated scores
2. Rank them (accounting for "timed" metrics where lower is better)
3. Convert rank to a percentile: `percentile = (rank - 1) / (total - 1) * 100`
4. A player's composite = average of their percentiles across all metrics they have scores for

**Example:**
- Player A: 60-yard = 7.1s (rank 3/20 = 84th percentile), Velo = 82mph (rank 2/20 = 89th), Fielding = 60 (rank 5/20 = 74th)
- Composite = (84 + 89 + 74) / 3 = **82.3**

This fairly compares players regardless of what units each metric uses, and the score reflects how they performed relative to the rest of the tryout group.

## Technical Changes

### 1. New utility function in `src/lib/metrics.ts`
Add a `computePercentiles` function that:
- Takes all players' scores maps and the metrics list
- For each metric, collects all values, sorts them, and assigns percentile ranks
- Returns a map of `playerId -> compositePercentile`

### 2. Update `src/pages/Dashboard.tsx`
- Replace the raw-average composite logic in `getDisplayScore` with the percentile-based composite
- Compute percentiles once after data loads (memoized alongside the `players` state)
- Display the composite as a 0-100 score with label "percentile" instead of "avg"
- When sorting by score in "All Metrics" mode, higher percentile = better (no special timed-metric inversion needed since percentiles are already normalized)

### 3. Display Updates
- Change the unit label from "avg" to "%" or "pctl" when viewing the composite
- Optionally show the player's rank position (e.g., "#3 of 20")

### What stays the same
- Individual metric views continue showing raw values (seconds, mph, etc.)
- The aggregation logic (best/average/latest) per metric is unchanged
- No database changes needed -- this is purely a client-side calculation

