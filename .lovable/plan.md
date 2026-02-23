

# Scout Discovery System + Player Profile UX Improvements

## Overview
Two changes: (1) Make the player profile settings more accessible and prominent, and (2) build a new "Scout" account type with a powerful filtered search engine so college coaches and scouts can discover players by athletic metrics, physical attributes, positions, and more.

## Part 1: Improve Player Profile Settings Access

Currently the social/profile editing (Twitter, Instagram, highlight video, GPA, height, weight, etc.) is buried at the bottom of the Player Dashboard page. We will:

- Add a **tabbed navigation** to the Player Dashboard with two tabs: "My Evaluations" and "My Profile"
- The "My Profile" tab contains the `PlayerProfileSettings` component front and center
- This makes it immediately discoverable instead of requiring players to scroll past evaluations

## Part 2: Scout / College Coach Account Type

### The Scout Flow
1. A scout signs up choosing "Scout" on the auth page (4th option alongside Coach, Player, Evaluator)
2. They land on a **Scout Dashboard** with a full-featured player search engine
3. They can filter and sort public player profiles by any combination of criteria
4. Clicking a result opens the player's public profile page (`/p/:slug`)

### Database Changes

**New table: `scouts`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid | Links to auth.users |
| full_name | text | Scout's name |
| organization_name | text | e.g., "University of Texas Baseball" |
| title | text (nullable) | e.g., "Recruiting Coordinator" |
| created_at | timestamptz | Auto |

**New database function: `search_public_players`**

A security definer function that powers the search. It queries players where `profile_public = true` and joins their aggregated metrics (from both `evaluations` and `evaluator_entries`) to enable filtering like:
- Position (e.g., "OF", "P", "C")
- Graduation year range
- Bats/throws preference
- Metric filters (e.g., "60 Yard Dash < 7.0", "Exit Velocity > 90")
- State/school (from program data)
- Sport

The function accepts filter parameters and returns matching players with their key metrics, sorted by relevance.

**RLS Policies:**
- `scouts`: Scouts can read/update/insert their own row; public can read for display
- The search function is security definer so it bypasses RLS and only returns public profiles

### Auth Changes
- Add "Scout" as a 4th signup option on the Auth page
- Store `account_type: "scout"` in user metadata
- Add `scoutInfo` to AuthContext
- New routing: scouts get redirected to Scout Dashboard

### New Pages and Components
- **`src/pages/ScoutDashboard.tsx`** -- The main scout interface with the search/filter engine
- **`src/components/PlayerSearchFilters.tsx`** -- Filter sidebar/panel with dropdowns and range inputs for metrics, position, grad year, bats/throws, etc.
- **`src/components/PlayerSearchResults.tsx`** -- Results grid/list showing matching player cards with key stats

### Search Filter UI

The search interface will include:
- **Position filter** -- multi-select dropdown (OF, IF, P, C, 1B, 2B, SS, 3B, etc.)
- **Graduation year** -- range or specific year
- **Bats/Throws** -- dropdown (L/R/S)
- **Physical attributes** -- height/weight ranges
- **Metric filters** -- dynamic: the scout picks a metric name (e.g., "60 Yard Dash") and sets a min/max value. Multiple metric filters can be stacked (e.g., "60 Yard Dash < 7.0 AND Exit Velocity > 90")
- **Sport** -- dropdown to filter by sport
- **Keyword search** -- player name search

Results show player cards with:
- Photo, name, positions, grad year, school
- Top 3-4 metrics with values
- Click through to full public profile

---

## Technical Details

### Migration SQL

```text
-- New scouts table
CREATE TABLE public.scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  organization_name text NOT NULL DEFAULT '',
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scouts can view own profile" ON public.scouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Scouts can update own profile" ON public.scouts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Scouts can insert own profile" ON public.scouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view scouts" ON public.scouts
  FOR SELECT USING (true);

-- Search function for public players with metric filtering
CREATE OR REPLACE FUNCTION public.search_public_players(
  _sport text DEFAULT NULL,
  _positions text[] DEFAULT NULL,
  _grad_year_min int DEFAULT NULL,
  _grad_year_max int DEFAULT NULL,
  _bats text DEFAULT NULL,
  _throws text DEFAULT NULL,
  _name_search text DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result json;
BEGIN
  SELECT COALESCE(json_agg(row_data), '[]'::json) INTO result
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'positions', p.positions,
      'photo_url', p.photo_url,
      'profile_slug', p.profile_slug,
      'graduation_year', p.graduation_year,
      'height', p.height,
      'weight', p.weight,
      'bats', p.bats,
      'throws', p.throws,
      'school_name', pr.school_name,
      'program_name', pr.name,
      'sport', pr.sport,
      'program_logo', pr.logo_url,
      'metrics', (
        SELECT COALESCE(json_agg(json_build_object(
          'name', metric_data.metric_name,
          'value', metric_data.best_value,
          'unit', metric_data.metric_unit
        )), '[]'::json)
        FROM (
          -- Program metrics
          SELECT m.name as metric_name, m.unit as metric_unit,
            CASE WHEN m.metric_type = 'timed' THEN MIN(e.value) ELSE MAX(e.value) END as best_value
          FROM evaluations e
          JOIN metrics m ON m.id = e.metric_id
          WHERE e.player_id = p.id AND m.visible_to_players = true
          GROUP BY m.name, m.unit, m.metric_type
          UNION ALL
          -- Evaluator metrics
          SELECT ee.metric_name, ee.metric_unit,
            CASE WHEN ee.metric_type = 'timed' THEN MIN(ee.metric_value) ELSE MAX(ee.metric_value) END
          FROM evaluator_entries ee
          WHERE ee.player_id = p.id
          GROUP BY ee.metric_name, ee.metric_unit, ee.metric_type
        ) metric_data
      )
    ) as row_data
    FROM players p
    JOIN programs pr ON pr.id = p.program_id
    WHERE p.profile_public = true
      AND (_sport IS NULL OR pr.sport = _sport)
      AND (_positions IS NULL OR p.positions && _positions)
      AND (_grad_year_min IS NULL OR p.graduation_year >= _grad_year_min)
      AND (_grad_year_max IS NULL OR p.graduation_year <= _grad_year_max)
      AND (_bats IS NULL OR p.bats = _bats)
      AND (_throws IS NULL OR p.throws = _throws)
      AND (_name_search IS NULL OR
        (LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER(_name_search) || '%'))
    ORDER BY p.last_name, p.first_name
    LIMIT _limit OFFSET _offset
  ) sub;

  RETURN result;
END;
$$;
```

### File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add "Scout" signup tab (4th option) |
| `src/contexts/AuthContext.tsx` | Add scout role detection + `scoutInfo` state |
| `src/App.tsx` | Add `/scout` route + `ScoutRoute` guard |
| `src/pages/ScoutDashboard.tsx` | NEW -- scout search interface |
| `src/components/PlayerSearchFilters.tsx` | NEW -- filter controls |
| `src/components/PlayerSearchResults.tsx` | NEW -- results grid with player cards |
| `src/pages/PlayerDashboard.tsx` | Add tabbed layout (Evaluations / My Profile) |
| DB migration | New `scouts` table + `search_public_players` function |

### Key Design Decisions
- The search function runs server-side as a security definer so it only ever returns public profiles -- no data leakage
- Metric filtering happens client-side initially (filter the `metrics` array in the returned results) to keep the DB function simpler. For scale, metric filtering can move into the SQL function later
- Scouts don't need to be "verified" -- they're consumers of public data, not data creators
- The search is limited to players who have opted in (`profile_public = true`)

