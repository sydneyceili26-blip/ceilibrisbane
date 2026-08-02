
-- Restrict avatar bucket to images only and enforce a 5MB size limit
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 5242880
WHERE id = 'avatars';

-- Tighten the INSERT policy to also enforce image-only MIME types
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'))
);

-- Also restrict UPDATE the same way if such a policy exists
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'))
);
