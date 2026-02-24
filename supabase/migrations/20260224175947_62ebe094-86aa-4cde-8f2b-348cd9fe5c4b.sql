
-- Create join requests table
CREATE TABLE public.program_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- Enable RLS
ALTER TABLE public.program_join_requests ENABLE ROW LEVEL SECURITY;

-- Players can insert their own requests
CREATE POLICY "Players can request to join"
ON public.program_join_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Players can view their own requests
CREATE POLICY "Players can view own requests"
ON public.program_join_requests FOR SELECT
USING (auth.uid() = user_id);

-- Coaches can view requests for their program
CREATE POLICY "Coaches can view program requests"
ON public.program_join_requests FOR SELECT
USING (is_program_coach(auth.uid(), program_id));

-- Coaches can update requests (approve/deny)
CREATE POLICY "Coaches can update program requests"
ON public.program_join_requests FOR UPDATE
USING (is_program_coach(auth.uid(), program_id));

-- Coaches can delete requests
CREATE POLICY "Coaches can delete program requests"
ON public.program_join_requests FOR DELETE
USING (is_program_coach(auth.uid(), program_id));

-- Players can delete own pending requests
CREATE POLICY "Players can cancel own requests"
ON public.program_join_requests FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Unique constraint: one pending request per user per program
CREATE UNIQUE INDEX idx_unique_pending_request
ON public.program_join_requests (program_id, user_id)
WHERE status = 'pending';
