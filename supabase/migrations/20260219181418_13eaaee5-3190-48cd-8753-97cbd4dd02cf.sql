
-- Role enum for coaches
CREATE TYPE public.coach_role AS ENUM ('head_coach', 'assistant_coach');

-- Metric category enum
CREATE TYPE public.metric_category AS ENUM ('running', 'hitting', 'fielding', 'pitching', 'other');

-- Metric type enum (determines scoring direction)
CREATE TYPE public.metric_type AS ENUM ('timed', 'measured', 'rated');

-- Player flag enum
CREATE TYPE public.player_flag AS ENUM ('standout', 'needs_second_look', 'concern');

-- Roster assignment enum
CREATE TYPE public.roster_assignment AS ENUM ('varsity', 'jv', 'freshman', 'cut');

-- Programs table
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  levels TEXT[] NOT NULL DEFAULT ARRAY['Varsity', 'JV', 'Freshman'],
  registration_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coaches table (profiles + role info)
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role coach_role NOT NULL DEFAULT 'assistant_coach',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  grade INTEGER,
  positions TEXT[] DEFAULT '{}',
  jersey_number_preference INTEGER,
  travel_ball_experience TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  medical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Custom metrics table
CREATE TABLE public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  category metric_category NOT NULL DEFAULT 'other',
  metric_type metric_type NOT NULL DEFAULT 'measured',
  min_value NUMERIC,
  max_value NUMERIC,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tryout sessions
CREATE TABLE public.tryout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session attendance
CREATE TABLE public.session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.tryout_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  UNIQUE(session_id, player_id)
);

-- Evaluations (scores from coaches)
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.tryout_sessions(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coach notes on players
CREATE TABLE public.player_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.tryout_sessions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  flag player_flag,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roster assignments
CREATE TABLE public.roster_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE UNIQUE,
  assignment roster_assignment NOT NULL,
  assigned_by UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tryout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is coach in a program
CREATE OR REPLACE FUNCTION public.is_program_coach(_user_id UUID, _program_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches
    WHERE user_id = _user_id AND program_id = _program_id
  )
$$;

-- Helper: check if user is head coach
CREATE OR REPLACE FUNCTION public.is_head_coach(_user_id UUID, _program_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches
    WHERE user_id = _user_id AND program_id = _program_id AND role = 'head_coach'
  )
$$;

-- Programs: creator can do anything, coaches can read
CREATE POLICY "Creator full access" ON public.programs FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Coaches can view program" ON public.programs FOR SELECT USING (public.is_program_coach(auth.uid(), id));

-- Coaches: coaches can view other coaches in their program, head coach can manage
CREATE POLICY "Coaches can view their program coaches" ON public.coaches FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can insert coaches" ON public.coaches FOR INSERT WITH CHECK (public.is_head_coach(auth.uid(), program_id) OR auth.uid() = user_id);
CREATE POLICY "Head coach can update coaches" ON public.coaches FOR UPDATE USING (public.is_head_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can delete coaches" ON public.coaches FOR DELETE USING (public.is_head_coach(auth.uid(), program_id));

-- Players: coaches in program can CRUD
CREATE POLICY "Coaches can view players" ON public.players FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can insert players" ON public.players FOR INSERT WITH CHECK (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can update players" ON public.players FOR UPDATE USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can delete players" ON public.players FOR DELETE USING (public.is_program_coach(auth.uid(), program_id));
-- Public registration - allow anonymous inserts via registration code (handled by edge function)

-- Metrics: coaches in program can CRUD
CREATE POLICY "Coaches can view metrics" ON public.metrics FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can insert metrics" ON public.metrics FOR INSERT WITH CHECK (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can update metrics" ON public.metrics FOR UPDATE USING (public.is_head_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can delete metrics" ON public.metrics FOR DELETE USING (public.is_head_coach(auth.uid(), program_id));

-- Sessions: coaches can CRUD
CREATE POLICY "Coaches can view sessions" ON public.tryout_sessions FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can insert sessions" ON public.tryout_sessions FOR INSERT WITH CHECK (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can update sessions" ON public.tryout_sessions FOR UPDATE USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can delete sessions" ON public.tryout_sessions FOR DELETE USING (public.is_program_coach(auth.uid(), program_id));

-- Attendance: coaches can manage
CREATE POLICY "Coaches can view attendance" ON public.session_attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tryout_sessions ts WHERE ts.id = session_id AND public.is_program_coach(auth.uid(), ts.program_id))
);
CREATE POLICY "Coaches can insert attendance" ON public.session_attendance FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tryout_sessions ts WHERE ts.id = session_id AND public.is_program_coach(auth.uid(), ts.program_id))
);
CREATE POLICY "Coaches can update attendance" ON public.session_attendance FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tryout_sessions ts WHERE ts.id = session_id AND public.is_program_coach(auth.uid(), ts.program_id))
);

-- Evaluations: coaches can CRUD their own, view all in program
CREATE POLICY "Coaches can view evaluations" ON public.evaluations FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can insert evaluations" ON public.evaluations FOR INSERT WITH CHECK (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can update own evaluations" ON public.evaluations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Coaches can delete own evaluations" ON public.evaluations FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);

-- Notes: coaches can CRUD their own, view all in program
CREATE POLICY "Coaches can view notes" ON public.player_notes FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can insert notes" ON public.player_notes FOR INSERT WITH CHECK (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Coaches can update own notes" ON public.player_notes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Coaches can delete own notes" ON public.player_notes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);

-- Roster assignments: head coach only for write, all coaches can view
CREATE POLICY "Coaches can view assignments" ON public.roster_assignments FOR SELECT USING (public.is_program_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can insert assignments" ON public.roster_assignments FOR INSERT WITH CHECK (public.is_head_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can update assignments" ON public.roster_assignments FOR UPDATE USING (public.is_head_coach(auth.uid(), program_id));
CREATE POLICY "Head coach can delete assignments" ON public.roster_assignments FOR DELETE USING (public.is_head_coach(auth.uid(), program_id));

-- Enable realtime for evaluations (live cross-coach visibility)
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_notes;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_player_notes_updated_at BEFORE UPDATE ON public.player_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_roster_assignments_updated_at BEFORE UPDATE ON public.roster_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast player search (alphabetical by last name)
CREATE INDEX idx_players_last_name ON public.players(program_id, last_name, first_name);
CREATE INDEX idx_evaluations_player ON public.evaluations(player_id, metric_id);
CREATE INDEX idx_evaluations_coach ON public.evaluations(coach_id);
