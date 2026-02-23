
-- 1. Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'coach');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create organizations table
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Create teams table
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 4. Add organization_id to programs
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS organization_id uuid;

-- 5. Add team_id to players (optional assignment)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS team_id uuid;

-- 6. Create organization_members table
CREATE TABLE public.organization_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'coach',
  full_name text NOT NULL,
  email text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_level CHECK (
    organization_id IS NOT NULL OR program_id IS NOT NULL OR team_id IS NOT NULL
  )
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 7. Migrate data using DO block to handle uuid MIN
DO $$
DECLARE
  rec RECORD;
  org_id uuid;
BEGIN
  -- Create one org per unique school_name
  FOR rec IN SELECT DISTINCT school_name, created_by FROM public.programs LOOP
    org_id := gen_random_uuid();
    INSERT INTO public.organizations (id, name, created_by) VALUES (org_id, rec.school_name, rec.created_by);
    -- Link programs
    UPDATE public.programs SET organization_id = org_id WHERE school_name = rec.school_name;
  END LOOP;

  -- Create default team per program
  FOR rec IN SELECT id FROM public.programs LOOP
    INSERT INTO public.teams (program_id, name) VALUES (rec.id, 'Main Team');
  END LOOP;

  -- Migrate coaches
  INSERT INTO public.organization_members (user_id, program_id, role, full_name, email, color)
  SELECT c.user_id, c.program_id,
    CASE WHEN c.role = 'head_coach' THEN 'admin'::public.app_role ELSE 'coach'::public.app_role END,
    c.full_name, c.email, c.color
  FROM public.coaches c;
END $$;

-- Add FK and NOT NULL after data is populated
ALTER TABLE public.programs
  ADD CONSTRAINT programs_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.programs ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.players
  ADD CONSTRAINT players_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- 8. Security definer functions
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_program_access(_user_id uuid, _program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    LEFT JOIN public.programs p ON p.id = _program_id
    WHERE om.user_id = _user_id
      AND (om.program_id = _program_id
        OR om.organization_id = p.organization_id
        OR om.team_id IN (SELECT t.id FROM public.teams t WHERE t.program_id = _program_id))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_program_admin(_user_id uuid, _program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    LEFT JOIN public.programs p ON p.id = _program_id
    WHERE om.user_id = _user_id AND om.role = 'admin'
      AND (om.program_id = _program_id OR om.organization_id = p.organization_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_team_access(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    LEFT JOIN public.teams t ON t.id = _team_id
    LEFT JOIN public.programs p ON p.id = t.program_id
    WHERE om.user_id = _user_id
      AND (om.team_id = _team_id OR om.program_id = t.program_id OR om.organization_id = p.organization_id)
  )
$$;

-- 9. RLS: organizations
CREATE POLICY "Members can view their org" ON public.organizations FOR SELECT
  USING (public.is_org_member(auth.uid(), id) OR auth.uid() = created_by);
CREATE POLICY "Creator full access on org" ON public.organizations FOR ALL
  USING (auth.uid() = created_by);

-- 10. RLS: teams
CREATE POLICY "Members can view teams" ON public.teams FOR SELECT
  USING (public.has_program_access(auth.uid(), program_id));
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL
  USING (public.is_program_admin(auth.uid(), program_id));

-- 11. RLS: organization_members
CREATE POLICY "Members can view co-members" ON public.organization_members FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
    OR (program_id IS NOT NULL AND public.has_program_access(auth.uid(), program_id))
    OR (team_id IS NOT NULL AND public.has_team_access(auth.uid(), team_id))
  );
CREATE POLICY "Admins can insert members" ON public.organization_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
    OR (program_id IS NOT NULL AND public.is_program_admin(auth.uid(), program_id))
  );
CREATE POLICY "Admins can update members" ON public.organization_members FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
    OR (program_id IS NOT NULL AND public.is_program_admin(auth.uid(), program_id))
  );
CREATE POLICY "Admins can delete members" ON public.organization_members FOR DELETE
  USING (
    (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
    OR (program_id IS NOT NULL AND public.is_program_admin(auth.uid(), program_id))
  );

-- 12. Update programs RLS
DROP POLICY IF EXISTS "Coaches can view program" ON public.programs;
DROP POLICY IF EXISTS "Creator full access" ON public.programs;
DROP POLICY IF EXISTS "Players can view own program" ON public.programs;

CREATE POLICY "Members can view program" ON public.programs FOR SELECT
  USING (
    public.has_program_access(auth.uid(), id)
    OR EXISTS (SELECT 1 FROM public.players pl WHERE pl.program_id = id AND pl.user_id = auth.uid())
  );
CREATE POLICY "Program admins full access" ON public.programs FOR ALL
  USING (public.is_program_admin(auth.uid(), id) OR auth.uid() = created_by);

-- 13. Triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
