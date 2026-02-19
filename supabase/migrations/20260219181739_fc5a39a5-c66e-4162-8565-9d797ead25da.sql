
-- Allow anonymous inserts to players if the program_id corresponds to a valid program
-- This enables the public player registration form
CREATE POLICY "Public player registration" ON public.players
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.programs WHERE id = program_id)
);

-- Allow anon to read programs by registration_code (for registration lookup)
CREATE POLICY "Public can lookup programs by reg code" ON public.programs
FOR SELECT
TO anon
USING (true);
