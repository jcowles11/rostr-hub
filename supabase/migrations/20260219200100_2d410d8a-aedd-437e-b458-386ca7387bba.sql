
-- Add photo_url column to players
ALTER TABLE public.players ADD COLUMN photo_url text;

-- Create storage bucket for player photos
INSERT INTO storage.buckets (id, name, public) VALUES ('player-photos', 'player-photos', true);

-- Anyone can view player photos (public bucket)
CREATE POLICY "Public can view player photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'player-photos');

-- Anyone can upload player photos (registration is public)
CREATE POLICY "Anyone can upload player photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'player-photos');

-- Coaches can update/delete player photos
CREATE POLICY "Coaches can update player photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'player-photos');

CREATE POLICY "Coaches can delete player photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'player-photos');
