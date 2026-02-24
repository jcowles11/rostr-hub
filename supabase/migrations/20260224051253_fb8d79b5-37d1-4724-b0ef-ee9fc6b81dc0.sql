-- Add DELETE policy for session_attendance so coaches can delete attendance records
CREATE POLICY "Coaches can delete attendance"
ON public.session_attendance
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM tryout_sessions ts
    WHERE ts.id = session_attendance.session_id
    AND is_program_coach(auth.uid(), ts.program_id)
  )
);