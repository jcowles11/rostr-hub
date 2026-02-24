

## Plan: Scout Account Refinement -- Search, Navigation, Profile, and Messaging

### Problems Identified

1. **Clicking a player card navigates away from search results** -- When a scout clicks a player card or the "Profile" button, it uses `navigate('/p/slug')` which replaces the current page and loses all search results. There is no way to return to the previous search.

2. **Search filters are missing key fields** -- No high school filter, no region/multi-state filter, no GameChanger/MaxPreps link visibility. The `search_public_players` RPC also lacks a `_high_school` parameter.

3. **Scout profile is too loose** -- Coaches should be required to fill out their university, title, and division. The current profile is entirely optional fields with no enforcement.

4. **Messaging has not been end-to-end tested** -- The data model and UI exist but no seed data populates scout/player messaging flows for testing.

---

### Part 1: Fix Player Profile Navigation (Don't Lose Search Results)

**Problem:** `navigate('/p/slug')` replaces the page.

**Solution:**
- In `PlayerSearchResults.tsx`, open player profiles in a **slide-over dialog/sheet** instead of navigating away. When the scout clicks a player card, fetch the public profile data via the existing `get_public_profile` RPC and display it in a `Sheet` (from shadcn) on the right side.
- The sheet will include quick-action buttons: **Save Prospect**, **Add to List**, **Message**, **Open Full Profile** (which navigates away intentionally).
- Add a "Clear Search" and "New Search" button above the results grid so scouts can explicitly reset.

**Files changed:**
- `src/components/PlayerSearchResults.tsx` -- Add Sheet-based profile preview, add Clear/New Search buttons
- Create `src/components/PlayerProfileSheet.tsx` -- Lightweight profile viewer that fetches `get_public_profile` and renders key info + action buttons inside a Sheet

---

### Part 2: Expand Search Filters

**Add to `PlayerSearchFilters.tsx`:**
- **High School** text input field (available to scouts)
- **Region** multi-select (Northeast, Southeast, Midwest, Southwest, West Coast, Northwest) that maps to groups of states -- selecting a region auto-selects those states
- **GameChanger / MaxPreps links** -- Show indicator badges on player cards when `gamechanger_profile_url` or `maxpreps_profile_url` is populated (display only, not a filter)

**Add to `SearchFilters` interface:**
- `highSchool?: string`

**Database changes:**
- Update `search_public_players` RPC to accept `_high_school text DEFAULT NULL` parameter and filter with `LOWER(p.high_school) LIKE '%' || LOWER(_high_school) || '%'`
- Return `gamechanger_profile_url` and `maxpreps_profile_url` in the search results JSON

**Update `PlayerResult` type** in `ScoutDashboard.tsx` to include `high_school`, `gamechanger_profile_url`, `maxpreps_profile_url`.

**Files changed:**
- `src/components/PlayerSearchFilters.tsx` -- Add high school input, region multi-select
- `src/pages/ScoutDashboard.tsx` -- Pass new filter, update PlayerResult type
- Database migration -- Update `search_public_players` RPC

---

### Part 3: Refine Scout Profile (Require Key Fields)

**Changes to `ScoutProfilePage.tsx`:**
- Add a title dropdown with predefined options: Head Coach, Associate Head Coach, Assistant Coach, Recruiting Coordinator, Director of Operations, Volunteer Assistant, Graduate Assistant
- Make Full Name, School/Organization, Title, and Division **required** with visual indicators and validation before save
- Add a completion progress indicator at the top showing which required fields are filled
- Improve the layout to feel more like a professional recruiter card

**No database changes needed** -- the `scouts` table already has all the columns.

**Files changed:**
- `src/pages/ScoutProfilePage.tsx` -- Add required field validation, title dropdown, completion indicator

---

### Part 4: Enhance Player Cards in Search Results

**Changes to `PlayerSearchResults.tsx`:**
- Show GameChanger/MaxPreps badge icons when URLs exist on a player
- Make the **Save**, **Add to List**, and **Message** buttons more prominent with labels (not just icons)
- Add high school name display on cards

**Files changed:**
- `src/components/PlayerSearchResults.tsx`

---

### Part 5: Seed Demo Data for Messaging Testing

**Update `seed-demo-data` edge function** to create:
- 3 demo scout accounts with filled-out profiles (titles, divisions, territories)
- Conversation requests from scouts to demo players (some pending, some accepted, some declined)
- Accepted conversations with back-and-forth messages

This enables immediate testing of:
- Scout sending a message request from search
- Player seeing pending requests and accepting/declining
- Both sides exchanging messages after acceptance

**Files changed:**
- `supabase/functions/seed-demo-data/index.ts`

---

### Part 6: Summary of All File Changes

| File | Change |
|------|--------|
| `src/components/PlayerSearchResults.tsx` | Sheet-based profile preview, Clear/New Search, prominent action buttons, GameChanger/MaxPreps badges |
| `src/components/PlayerSearchFilters.tsx` | High school input, region multi-select |
| `src/pages/ScoutDashboard.tsx` | Updated PlayerResult type, pass new filters |
| `src/pages/ScoutProfilePage.tsx` | Required field validation, title dropdown, completion indicator |
| `src/components/PlayerProfileSheet.tsx` | New component -- slide-over profile viewer with actions |
| `supabase/functions/seed-demo-data/index.ts` | Seed messaging demo data |
| Database migration | Update `search_public_players` RPC with `_high_school` param and return external profile URLs |

### Security
No new tables or RLS changes needed. All existing RLS policies remain intact. The search RPC changes only add filtering parameters to an existing `SECURITY DEFINER` function.

