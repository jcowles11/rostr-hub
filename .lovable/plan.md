

# Product Strategy & Architecture Plan for Rostr

## Your Decisions (Summarized)

1. **Coach + Evaluator: Keep separate, but add a lighter "Evaluator" tier** for private lesson coaches who just need to track individual player metrics without tryout/roster management. Full evaluator accounts handle showcases and bulk events.

2. **Scout search must be ultra-customizable** — compound metric filters, GPA, location/state, batting average, stolen bases, school size. This is the paid value proposition.

3. **No Stripe yet** — sell enterprise first to HS and club teams, add billing later when scout demand is proven.

4. **Seasons: manual creation by coaches**, with all historical data accessible but not overwhelming. Players and coaches can view progression over time.

---

## What Needs to Be Built (Prioritized)

### Phase 1: Fix Current Broken Navigation (Immediate)

**Problem**: Scout accounts can't access Social or Search from the current UI. The `UnifiedNavShell` is wrapping scout/player/evaluator routes but the routing and navigation aren't connecting properly.

**Changes**:
- Verify that `/scout` route correctly renders inside `UnifiedNavShell` with Search as landing + Social and Profile tabs
- Verify that `/social` route works for all roles when wrapped in `UnifiedNavShell`
- Test the coach bottom nav (Roster, Score, Stats, Social, More) — the Social tab needs to navigate coaches into the `UnifiedNavShell` context seamlessly, then allow them to return to coach mode

**Key architectural issue**: When a coach taps "Social", they currently navigate to `/social` which is wrapped in `UnifiedNavShell`, but they lose the coach header (program switcher, event selector). When they tap back, they need to return to `AppLayout`. This transition needs to feel seamless — not like switching apps.

**Solution**: For coaches, the `/social` route should either:
- Keep the coach bottom nav visible (with Social highlighted) and render `SocialHome` directly inside `AppLayout`, OR
- Navigate to `UnifiedNavShell` but include a clear "Back to Coach" affordance

**Recommendation**: Render Social inside `AppLayout` for coaches (simpler, no context switching). The Social tab in the coach bottom nav just renders the social feed in the same shell. Only scouts and players use `UnifiedNavShell`.

### Phase 2: Scout Search Enhancements (High Priority)

**Database changes needed**:
- Add `_state` and `_gpa_min` parameters to the `search_public_players` RPC function
- Ensure `city`, `state`, `gpa` columns on `players` table are searchable (they already exist)

**New scout-only filters to add to `PlayerSearchFilters.tsx`**:
- State/region dropdown (US states list)
- GPA minimum (number input)
- Multiple simultaneous metric filters with compound logic (already partially built — needs polish)
- Future: batting average, stolen bases, school size (these require stats integration data that doesn't exist yet — placeholder UI only)

**RPC function update**: Add `_state` and `_gpa_min` parameters to `search_public_players`.

### Phase 3: Season/Year System for Coaches (Medium Priority)

**Database changes**:
- New `seasons` table: `id`, `program_id`, `name` (e.g., "2024-2025"), `start_date`, `end_date`, `created_at`
- Add `season_id` (nullable) to `evaluations` table and `tryout_sessions` table
- Default: if `season_id` is null, data is "unassigned" and visible in all views

**Coach UX**:
- Settings page: create/manage seasons manually
- Header or filter: toggle between seasons (dropdown next to event selector)
- "All Time" view shows everything; specific season filters to that window
- Player detail page: show progression chart across seasons

**No auto-detection** — coaches create seasons manually. This keeps it simple and works for both HS (academic year) and club (calendar year) programs.

### Phase 4: Social Feed Enhancements for Players (Medium Priority)

**Goal**: Make Social sticky for players so they open the app daily.

**Features** (in priority order):
1. **Commitment celebrations** — when a player updates status to "committed", it appears as a prominent card in the feed with school logo, confetti styling
2. **Highlight video previews** — if a player has a `highlight_video_url`, show a thumbnail/link in their card
3. **"Players in your class"** — filter social feed by graduation year matching the current player
4. **Browse by position** — quick filter chips on social home (P, C, IF, OF, etc.)

**Not building yet** (future):
- Follow system (requires new `follows` table, notification infrastructure)
- Achievement badges (requires event system)
- Messaging

### Phase 5: Evaluator Account Refinement (Lower Priority)

**Current state**: Evaluators can enter metrics for any player via `evaluator_entries`. This already works.

**Lighter evaluator use case** (private lessons):
- Same account type, but the onboarding flow asks: "Are you a private instructor or showcase organizer?"
- Private instructors get a simplified UI: search for a player → enter metrics. No bulk import, no event management.
- Showcase organizers get the full evaluator dashboard with bulk entry and event tagging.

**This is a UI-only change** — the data model already supports both use cases via `evaluator_entries`.

---

## Implementation Plan (What Changes Now)

### Files to modify:
1. **`src/components/AppLayout.tsx`** — Render `SocialHome` directly when coach navigates to `/social`, keeping the coach bottom nav active
2. **`src/pages/SocialPage.tsx`** — Update to handle coach role rendering within AppLayout context
3. **`src/components/UnifiedNavShell.tsx`** — Ensure scout nav works (Search, Social, Profile)
4. **`src/components/PlayerSearchFilters.tsx`** — Add State and GPA filters for scouts
5. **`src/pages/ScoutDashboard.tsx`** — Pass new filter params to RPC

### Database migration:
- Update `search_public_players` RPC to add `_state` and `_gpa_min` parameters

### No new tables yet (seasons deferred to next sprint)

---

## Technical Details

### Coach Social Navigation Fix

The coach bottom nav currently has Social pointing to `/social`. Since `/social` uses `UnifiedNavShell` (a completely different layout), coaches lose their program switcher and event selector. 

**Fix**: Change the coach routing so `/social` for coaches renders `SocialHome` inside `AppLayout` instead of navigating to the `UnifiedNavShell` wrapper. This means:
- In `App.tsx`, the `/social` route for coaches should be a `ProtectedRoute` wrapping `SocialHome` (not `SocialRoute` + `UnifiedNavShell`)
- The `SocialRoute` + `UnifiedNavShell` wrapper remains for players, evaluators, and scouts

This requires splitting the `/social` route by role, or having the `SocialRoute` component detect role and render the appropriate shell.

### Scout Search RPC Enhancement

```sql
-- Add _state and _gpa_min to search_public_players
AND (_state IS NULL OR p.state = _state)
AND (_gpa_min IS NULL OR p.gpa::numeric >= _gpa_min)
```

Note: `gpa` is stored as `text`, so casting to `numeric` requires a safe cast or COALESCE.

### State Filter UI

A dropdown with all 50 US states + DC, rendered only when `isScout={true}` in `PlayerSearchFilters.tsx`.

---

## Summary

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Fix coach Social nav (no shell switch) | Small | High — coaches can access Social without losing context |
| 2 | Fix scout nav (Search + Social working) | Small | High — scout accounts become functional |
| 3 | Add State + GPA filters for scouts | Small | High — differentiates scout value |
| 4 | Season system for coaches | Medium | High — multi-year tracking |
| 5 | Social feed enhancements for players | Medium | Medium — retention driver |
| 6 | Evaluator onboarding split | Small | Low — UX polish |

I recommend implementing priorities 1-3 now (immediate fixes + scout value), then tackling seasons and social feed in the next iteration.

