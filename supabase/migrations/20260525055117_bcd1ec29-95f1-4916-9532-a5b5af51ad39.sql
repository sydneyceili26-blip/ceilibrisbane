
-- 1. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public.
-- These functions are only used internally (RLS policies, auth triggers) and must not be callable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- 2. Allow moderators/admins to delete spam/abusive questions and answers.
CREATE POLICY "Mods can delete any question"
ON public.questions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Mods can delete any answer"
ON public.answers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- 3. Restrict listing-images bucket to images and cap file size at 5 MB.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
WHERE id = 'listing-images';
