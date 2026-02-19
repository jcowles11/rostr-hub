
-- Change roster_assignments.assignment from enum to text
ALTER TABLE public.roster_assignments 
  ALTER COLUMN assignment TYPE text USING assignment::text;

-- Update default program levels to include C team
ALTER TABLE public.programs 
  ALTER COLUMN levels SET DEFAULT ARRAY['Varsity', 'JV', 'C', 'Freshman', 'Cut'];
