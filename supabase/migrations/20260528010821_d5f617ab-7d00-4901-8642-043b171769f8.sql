
-- 1. Prevent impersonation in questions/answers anonymous posts
DROP POLICY IF EXISTS "Anyone can create questions" ON public.questions;
CREATE POLICY "Anyone can create questions"
ON public.questions
FOR INSERT
TO public
WITH CHECK (
  (author_name IS NULL OR (length(author_name) <= 60 AND length(trim(author_name)) > 0))
  AND (
    author_name IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(p.display_name) = lower(trim(questions.author_name))
        AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    )
  )
);

DROP POLICY IF EXISTS "Anyone can create answers" ON public.answers;
CREATE POLICY "Anyone can create answers"
ON public.answers
FOR INSERT
TO public
WITH CHECK (
  (author_name IS NULL OR (length(author_name) <= 60 AND length(trim(author_name)) > 0))
  AND (
    author_name IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(p.display_name) = lower(trim(answers.author_name))
        AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    )
  )
);

-- 2. Restrict guest folder uploads to image files under 5 MB
DROP POLICY IF EXISTS "Anyone can upload to guest folder" ON storage.objects;
CREATE POLICY "Anyone can upload to guest folder"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = 'guest'
  AND lower(coalesce(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
);
