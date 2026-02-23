
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
        SELECT e.metric_id, 
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

-- RLS: allow anonymous/public select on players with profile_public = true
CREATE POLICY "Public can view public profiles"
  ON public.players FOR SELECT
  USING (profile_public = true);
