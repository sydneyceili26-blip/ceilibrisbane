
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill expires_at = created_at + 60 days for existing rows
UPDATE public.listings SET expires_at = created_at + INTERVAL '60 days' WHERE expires_at IS NULL;

-- Default for new rows
ALTER TABLE public.listings ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '60 days');
ALTER TABLE public.listings ALTER COLUMN expires_at SET NOT NULL;

-- Storage bucket for listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Listing images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their listing images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their listing images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Also allow guests to upload to a shared "guest" folder so anonymous posters can attach photos
CREATE POLICY "Anyone can upload to guest folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = 'guest');
