-- Add logo_url column to programs table
ALTER TABLE public.programs ADD COLUMN logo_url text DEFAULT NULL;

-- Create storage bucket for program logos
INSERT INTO storage.buckets (id, name, public) VALUES ('program-logos', 'program-logos', true);

-- Allow coaches to upload logos for their program
CREATE POLICY "Coaches can upload program logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'program-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.user_id = auth.uid()
    AND c.program_id::text = (storage.foldername(name))[1]
  )
);

-- Allow coaches to update/replace logos
CREATE POLICY "Coaches can update program logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'program-logos'
  AND EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.user_id = auth.uid()
    AND c.program_id::text = (storage.foldername(name))[1]
  )
);

-- Allow coaches to delete logos
CREATE POLICY "Coaches can delete program logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'program-logos'
  AND EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.user_id = auth.uid()
    AND c.program_id::text = (storage.foldername(name))[1]
  )
);

-- Public read access for logos
CREATE POLICY "Public can view program logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'program-logos');