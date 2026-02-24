-- Allow authenticated users to claim unclaimed player records (user_id IS NULL)
-- by setting their own user_id on the record
CREATE POLICY "Players can claim unclaimed records"
ON public.players
FOR UPDATE
USING (user_id IS NULL)
WITH CHECK (auth.uid() = user_id);

-- Allow coaches to customize registration codes
-- (already covered by "Program admins full access" ALL policy on programs)