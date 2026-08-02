DROP POLICY IF EXISTS "Authenticated users can upload listing images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their listing images" ON storage.objects;

CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE((metadata->>'mimetype'), '')) = ANY (ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'
  ])
  AND COALESCE(((metadata->>'size'))::bigint, 0) <= 5242880
);

CREATE POLICY "Authenticated users can update their listing images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'listing-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'listing-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE((metadata->>'mimetype'), '')) = ANY (ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'
  ])
  AND COALESCE(((metadata->>'size'))::bigint, 0) <= 5242880
);