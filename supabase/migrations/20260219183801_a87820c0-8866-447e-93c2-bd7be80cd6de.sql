
-- Add player_number column
ALTER TABLE public.players ADD COLUMN player_number integer;

-- Create a function to auto-assign player number per program
CREATE OR REPLACE FUNCTION public.assign_player_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  SELECT COALESCE(MAX(player_number), 0) + 1
  INTO NEW.player_number
  FROM public.players
  WHERE program_id = NEW.program_id;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER assign_player_number_trigger
BEFORE INSERT ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.assign_player_number();
