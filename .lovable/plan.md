

# Verified Evaluators System

## Overview
Add a new "Verified Evaluator" account type that allows private coaches, showcase directors, and independent trainers to submit verified metrics for players -- without being part of the player's school program. This ensures athletes can get updated, credible data from multiple trusted sources beyond just their HS coaching staff.

## How It Works

### The Evaluator Flow
1. An evaluator signs up as a "Verified Evaluator" (new option on the auth page alongside Coach and Player)
2. They create an evaluator profile with their name, organization/business name, and credentials
3. They search for a player by name or profile slug, or receive an "evaluation link" from the player
4. They submit metrics (e.g., fastball velo = 91 MPH) which get tagged with their identity and timestamp
5. The metric appears on the player's public profile with a "Verified" badge showing *who* evaluated it (e.g., "Verified by Coach Mike, Elite Pitching Academy")

### Player Experience
- Players see all their evaluations grouped by source on their dashboard
- On the public profile, each metric shows its best value with the evaluator source
- Multiple evaluations from different sources build credibility (e.g., "91 MPH - Elite Pitching Academy, Jan 2026" and "89 MPH - Lincoln HS Tryout, Mar 2026")

### Trust and Integrity
- Evaluators cannot modify or delete evaluations from other evaluators
- Players cannot create or modify any evaluation data
- Each evaluation is permanently tied to the evaluator who submitted it
- Future enhancement: evaluator verification/approval process

---

## Technical Details

### Database Changes

**New table: `evaluators`**
Stores verified evaluator profiles, separate from coaches.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid | Links to auth.users |
| full_name | text | Evaluator's name |
| organization_name | text | e.g., "Elite Pitching Academy" |
| title | text (nullable) | e.g., "Pitching Coach", "Scout" |
| sport | text | Primary sport |
| verified | boolean (default false) | For future admin approval flow |
| created_at | timestamptz | Auto |

**New table: `evaluator_entries`**
Stores metrics submitted by evaluators (separate from the `evaluations` table used by program coaches).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| evaluator_id | uuid (FK) | References evaluators |
| player_id | uuid (FK) | References players |
| metric_name | text | e.g., "Fastball Velocity" |
| metric_value | numeric | The measured value |
| metric_unit | text | e.g., "MPH", "seconds" |
| metric_type | text | "timed", "measured", "rated" |
| event_name | text (nullable) | e.g., "Summer Showcase 2026" |
| event_date | date (nullable) | When measured |
| notes | text (nullable) | Additional context |
| created_at | timestamptz | Auto |

**Why a separate table instead of adding evaluator support to `evaluations`?**
- The existing `evaluations` table is tightly coupled to program metrics (metric_id FK, program_id FK, coach_id FK, session_id FK)
- Evaluator entries are freestyle -- they define the metric name/unit inline because evaluators aren't part of any program's configured metric system
- Keeps program coach data isolated and clean
- Simpler RLS policies without cross-role complexity

**RLS Policies:**
- `evaluators`: Evaluators can read/update their own row; public can read for display
- `evaluator_entries`: Evaluators can INSERT/UPDATE/DELETE their own entries; anyone can SELECT (for public profiles)

### Auth Changes
- Add "Verified Evaluator" as a third signup option on the Auth page (alongside Coach and Player)
- Store `account_type: "evaluator"` in user metadata
- New routing: evaluators get redirected to an Evaluator Dashboard

### New Pages and Components
- **`src/pages/EvaluatorDashboard.tsx`** -- Main evaluator interface: search players, submit evaluations, view history
- **`src/components/EvaluatorSubmitForm.tsx`** -- Form to submit a metric entry for a player (metric name, value, unit, event context)
- Updated **`src/pages/Auth.tsx`** -- Add evaluator signup option
- Updated **`src/pages/PublicProfile.tsx`** -- Show evaluator-submitted metrics alongside program coach metrics, with source attribution
- Updated **`src/contexts/AuthContext.tsx`** -- Handle evaluator role detection and state
- Updated **`src/App.tsx`** -- Add evaluator routes and guards

### Updated `get_public_profile` Function
The security definer function will be updated to also pull from `evaluator_entries`, returning them with the evaluator's name and organization so the public profile shows:
- Program coach metrics (labeled "Verified by [Program Name]")
- Evaluator metrics (labeled "Verified by [Evaluator Name], [Organization]")

### Migration SQL Summary

```text
-- New evaluators table
CREATE TABLE public.evaluators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  organization_name text NOT NULL DEFAULT '',
  title text,
  sport text NOT NULL DEFAULT 'baseball',
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluators ENABLE ROW LEVEL SECURITY;

-- New evaluator_entries table
CREATE TABLE public.evaluator_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluator_id uuid NOT NULL REFERENCES public.evaluators(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text NOT NULL DEFAULT '',
  metric_type text NOT NULL DEFAULT 'measured',
  event_name text,
  event_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluator_entries ENABLE ROW LEVEL SECURITY;

-- RLS for evaluators
CREATE POLICY "Evaluators can view own profile" ON public.evaluators
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Evaluators can update own profile" ON public.evaluators
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Evaluators can insert own profile" ON public.evaluators
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view evaluators" ON public.evaluators
  FOR SELECT USING (true);

-- RLS for evaluator_entries
CREATE POLICY "Evaluators can insert entries" ON public.evaluator_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.evaluators e WHERE e.id = evaluator_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Evaluators can update own entries" ON public.evaluator_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.evaluators e WHERE e.id = evaluator_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Evaluators can delete own entries" ON public.evaluator_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.evaluators e WHERE e.id = evaluator_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Public can view entries" ON public.evaluator_entries
  FOR SELECT USING (true);
```

### File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add "Evaluator" signup tab |
| `src/contexts/AuthContext.tsx` | Add evaluator role detection + state |
| `src/App.tsx` | Add evaluator routes + guards |
| `src/pages/EvaluatorDashboard.tsx` | NEW -- evaluator main page |
| `src/components/EvaluatorSubmitForm.tsx` | NEW -- metric submission form |
| `src/pages/PublicProfile.tsx` | Show evaluator entries with source |
| `src/pages/PlayerDashboard.tsx` | Show evaluator entries in player view |
| DB migration | New tables + RLS + updated `get_public_profile` |

