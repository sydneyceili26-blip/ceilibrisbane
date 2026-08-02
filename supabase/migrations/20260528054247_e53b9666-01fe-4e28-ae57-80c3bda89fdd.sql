
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp','gif'])
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  AND COALESCE(((metadata ->> 'size')::bigint), 0) <= 5242880
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp','gif'])
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  AND COALESCE(((metadata ->> 'size')::bigint), 0) <= 5242880
);
