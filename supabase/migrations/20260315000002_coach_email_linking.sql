-- Coach Email Linking Migration
-- Allows invited coaches to claim their placeholder records by matching email.
--
-- Problem: CoachManager creates placeholder coach records with a random user_id
-- and the invited coach's email. When the coach signs up, AuthContext needs to
-- update the user_id to link them. But the coaches UPDATE RLS policy only allows
-- head coaches to update. The new coach can't update their own record because
-- they aren't recognized as a coach yet.
--
-- Solution: Add a database function with SECURITY DEFINER that safely links
-- a coach record by matching email to the authenticated user. This bypasses
-- RLS for this specific, controlled operation.

CREATE OR REPLACE FUNCTION public.link_coach_by_email(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_coach_id uuid;
  v_result json;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find a placeholder coach record matching this email
  -- (placeholder = user_id doesn't match any auth.users entry, or simply != current user)
  SELECT id INTO v_coach_id
  FROM public.coaches
  WHERE lower(email) = lower(target_email)
    AND user_id != v_user_id
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No matching coach invitation found');
  END IF;

  -- Check that the current user doesn't already have a coach record in the same program
  IF EXISTS (
    SELECT 1 FROM public.coaches c1
    JOIN public.coaches c2 ON c1.program_id = c2.program_id
    WHERE c1.id = v_coach_id AND c2.user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Already a coach in this program');
  END IF;

  -- Link the coach record to this user
  UPDATE public.coaches
  SET user_id = v_user_id
  WHERE id = v_coach_id;

  RETURN json_build_object('success', true, 'coach_id', v_coach_id);
END;
$$;
