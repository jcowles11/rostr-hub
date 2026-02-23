

# Phase 1: Public Player Profiles

## Overview
Add shareable public player profile pages that display verified metrics from coach evaluations. Players control what's visible via privacy settings, and all coach-entered data gets a "Verified" badge showing credibility.

## What Gets Built

### 1. Database Changes

**New columns on `players` table:**
- `profile_slug` (text, unique) -- URL-friendly identifier like `john-smith-a1b2`
- `profile_public` (boolean, default false) -- master toggle for public profile
- `show_contact_info` (boolean, default false) -- opt-in for showing contact/social
- `graduation_year` (integer, nullable) -- for recruiting context
- `height` (text, nullable) -- e.g. "5'11"
- `weight` (integer, nullable) -- in lbs
- `gpa` (text, nullable) -- academic info
- `social_twitter` (text, nullable) -- social handle
- `social_instagram` (text, nullable)
- `highlight_video_url` (text, nullable) -- YouTube/Hudl link

**Auto-generate slugs:** A database trigger will auto-generate `profile_slug` on insert using `first_name-last_name-random4chars`, ensuring uniqueness.

**RLS:** A new SELECT policy allows anyone to read a player's row when `profile_public = true` (for the public profile page).

### 2. Public Profile Page (`/p/:slug`)

A new unauthenticated route that displays:
- Player photo, name, grad year, height/weight, positions
- Sport and program name (e.g. "Eagles Baseball")
- Verified metrics with a checkmark badge (source: coach evaluations)
  - Each metric shows the aggregated value, unit, and a "Verified" indicator
  - Uses the existing `aggregateValues` and `computePercentiles` logic
- Percentile composite score as a visual indicator
- Optional: highlight video embed, social links, GPA (if player opted in)
- Program logo for branding

This page works without authentication -- it reads only from public-flagged profiles.

### 3. Player Privacy Controls

On the **Player Dashboard** (`/player-dashboard`), add a new "My Public Profile" settings section:
- Toggle: "Make my profile public"
- Toggle: "Show contact info"
- Fields to add/edit: graduation year, height, weight, GPA, social handles, highlight video URL
- A "Copy Profile Link" button that copies the public URL
- Preview of what the public profile looks like

### 4. Backend Functions for Public Access

Create a database function `get_public_profile(slug text)` (security definer) that returns player data + their verified metrics only when `profile_public = true`. This avoids exposing RLS complexity to the public route and ensures only opted-in data is returned.

### 5. Routing

Add `/p/:slug` as an unauthenticated route in `App.tsx` pointing to a new `PublicProfile` page component.

---

## Technical Details

### Database Migration SQL

```text
-- Add profile columns to players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS profile_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_contact_info boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS graduation_year integer,
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight integer,
  ADD COLUMN IF NOT EXISTS gpa text,
  ADD COLUMN IF NOT EXISTS social_twitter text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS highlight_video_url text;

-- Auto-generate slugs for existing players
UPDATE public.players
SET profile_slug = LOWER(
  REGEXP_REPLACE(first_name, '[^a-zA-Z0-9]', '', 'g') || '-' ||
  REGEXP_REPLACE(last_name, '[^a-zA-Z0-9]', '', 'g') || '-' ||
  SUBSTR(id::text, 1, 4)
)
WHERE profile_slug IS NULL;

-- Trigger to auto-generate slug on new inserts
CREATE OR REPLACE FUNCTION public.generate_player_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.profile_slug IS NULL THEN
    NEW.profile_slug := LOWER(
      REGEXP_REPLACE(NEW.first_name, '[^a-zA-Z0-9]', '', 'g') || '-' ||
      REGEXP_REPLACE(NEW.last_name, '[^a-zA-Z0-9]', '', 'g') || '-' ||
      SUBSTR(NEW.id::text, 1, 4)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_player_slug
  BEFORE INSERT ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.generate_player_slug();

-- Public profile read access (security definer function)
CREATE OR REPLACE FUNCTION public.get_public_profile(_slug text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'player', json_build_object(
      'first_name', p.first_name, 'last_name', p.last_name,
      'positions', p.positions, 'photo_url', p.photo_url,
      'graduation_year', p.graduation_year, 'height', p.height,
      'weight', p.weight, 'gpa', CASE WHEN p.show_contact_info THEN p.gpa ELSE NULL END,
      'social_twitter', CASE WHEN p.show_contact_info THEN p.social_twitter ELSE NULL END,
      'social_instagram', CASE WHEN p.show_contact_info THEN p.social_instagram ELSE NULL END,
      'highlight_video_url', p.highlight_video_url,
      'profile_slug', p.profile_slug
    ),
    'program', json_build_object(
      'name', pr.name, 'school_name', pr.school_name,
      'sport', pr.sport, 'logo_url', pr.logo_url
    ),
    'metrics', (
      SELECT COALESCE(json_agg(json_build_object(
        'name', m.name, 'unit', m.unit, 'metric_type', m.metric_type,
        'value', sub.agg_value, 'verified', true
      )), '[]'::json)
      FROM metrics m
      INNER JOIN (
        SELECT metric_id, 
          CASE WHEN m2.metric_type = 'timed' THEN MIN(e.value) ELSE MAX(e.value) END as agg_value
        FROM evaluations e
        JOIN metrics m2 ON m2.id = e.metric_id
        WHERE e.player_id = p.id AND m2.visible_to_players = true
        GROUP BY e.metric_id, m2.metric_type
      ) sub ON sub.metric_id = m.id
      WHERE m.program_id = p.program_id AND m.visible_to_players = true
    )
  ) INTO result
  FROM players p
  JOIN programs pr ON pr.id = p.program_id
  WHERE p.profile_slug = _slug AND p.profile_public = true;

  RETURN result;
END;
$$;

-- RLS: allow public select on players with profile_public = true
CREATE POLICY "Public can view public profiles"
  ON public.players FOR SELECT
  USING (profile_public = true);
```

### New Files
- `src/pages/PublicProfile.tsx` -- Public-facing profile page (unauthenticated)
- `src/components/PlayerProfileSettings.tsx` -- Privacy controls + profile editing for player dashboard

### Modified Files
- `src/App.tsx` -- Add `/p/:slug` route
- `src/pages/PlayerDashboard.tsx` -- Add profile settings section with link to controls
- `src/integrations/supabase/types.ts` -- Auto-updated after migration

### File Structure

```text
src/
  pages/
    PublicProfile.tsx        (NEW - public profile view)
  components/
    PlayerProfileSettings.tsx (NEW - privacy/profile editing)
```

### Key Design Decisions
- Slug-based URLs (`/p/john-smith-a1b2`) are user-friendly and shareable
- Security definer function ensures only public profiles leak data -- no RLS bypass risk
- Metrics shown on public profiles are always "verified" since they come from coach evaluations
- Players control visibility granularly (master toggle + contact info toggle)
- Highlight video is a URL field (YouTube/Hudl link) -- no file storage needed initially

