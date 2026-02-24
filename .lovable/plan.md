

## Plan: Intuitive Metric Filtering for Scout Search

### Problem

The current metric filtering UX is buried at the bottom of the scout filters panel inside a dashed-border box. Coaches must: (1) open a dropdown to pick a metric, (2) type min/max into tiny inputs, (3) click "Add Filter" -- then repeat for each metric. It feels like building a database query, not searching for players. The metrics are also a flat, unsorted list mixing speed, arm, and hitting categories together.

---

### Solution: Grouped Metric Quick-Filters with Inline Sliders

Replace the current "select metric → type min/max → add" workflow with a categorized, always-visible set of common metrics that coaches can toggle on and set ranges with sliders -- no "Add" button needed.

---

### Design

**1. Organize metrics into categories with collapsible sections**

Group the 13 metrics into 4 intuitive buckets:

- **Speed**: 30 Yard Dash, 60-Yard Dash, Home to First
- **Arm**: Arm Velocity (C), Arm Velocity (IF), Arm Velocity (OF)
- **Pitching**: Fastball Velo, CH Velo, Curveball Velocity
- **Hitting/Fielding**: Exit Velocity, Fielding, Hitting, Hustle/Attitude

Each category is a collapsible `Collapsible` section (from shadcn) with a header showing the category name and a count badge of active filters in that category.

**2. Each metric becomes a toggle + inline range**

Instead of a dropdown + separate inputs + Add button:
- Each metric is a row with a toggle chip (on/off) and, when toggled on, shows a min/max range inline using two small number inputs side by side
- Toggling a metric on immediately adds it to the active filters; toggling off removes it
- No "Add Filter" button needed -- it's direct manipulation

**3. Active metric summary chips at the top**

Above the metric categories, show a horizontal row of active filter badges (e.g., "Fastball Velo ≥ 85") with X buttons to quickly remove them. This gives coaches an at-a-glance view of what metric filters are active.

**4. Move metrics section higher in the filter panel**

Currently metrics are the very last filter. Move them up to sit right after Positions and Grad Year -- the most natural flow for a recruiting search is: position → class → measurables → location → status.

---

### Reordered Filter Layout (for scouts)

```text
1. Player Name
2. Sport
3. Positions (toggle chips)
4. Graduation Year (min/max)
5. Bats / Throws
6. ── Metrics ──────────────────
   [Active filter chips: "FB Velo ≥ 85" ✕ | "60 ≤ 7.0" ✕]
   ▸ Speed (1 active)
   ▸ Arm
   ▸ Pitching (1 active)
   ▸ Hitting/Fielding
7. High School
8. Recruiting Status
9. Region / State
10. GPA Minimum
11. [Search] [Clear]
```

---

### File Changes

| File | Change |
|------|--------|
| `src/components/PlayerSearchFilters.tsx` | Replace the metric filter section with categorized collapsible groups, toggle-on/off per metric with inline min/max inputs, active filter chip summary, reorder sections so metrics appear after Bats/Throws |

**No database changes.** Metric filtering is already client-side post-search in `ScoutDashboard.tsx`. The filter interface change is purely UI.

**No new components needed.** Uses existing `Collapsible` and `Badge` from shadcn.

---

### Technical Details

- The `METRIC_OPTIONS` constant gets replaced with a `METRIC_CATEGORIES` map:
  ```ts
  const METRIC_CATEGORIES: Record<string, string[]> = {
    "Speed": ["30 Yard Dash", "60-Yard Dash", "Home to First"],
    "Arm": ["Arm Velocity (C)", "Arm Velocity (IF)", "Arm Velocity (OF)"],
    "Pitching": ["Fastball Velo", "CH Velo", "Curveball Velocity"],
    "Hitting & Fielding": ["Exit Velocity", "Fielding", "Hitting", "Hustle/Attitude"],
  };
  ```
- The `metricFilters` state stays as `MetricFilter[]` -- no interface changes needed
- Toggling a metric on adds a `MetricFilter` entry with undefined min/max; typing into the range inputs updates it in place
- The `SearchFilters` interface and `ScoutDashboard.tsx` handling remain unchanged -- this is a pure UI refactor of the filter panel

