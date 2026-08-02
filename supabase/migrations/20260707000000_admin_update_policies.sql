-- Fix admin approval on Melbourne
-- Run this in the Melbourne Supabase SQL Editor

-- 1. Ensure UPDATE grant exists for all content tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_posts TO anon, authenticated;

-- 2. Add UPDATE RLS policy for admins/mods on listings
DROP POLICY IF EXISTS "Admins can update any listing" ON public.listings;
CREATE POLICY "Admins can update any listing"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Allow owners to update their own listings too
DROP POLICY IF EXISTS "Owners can update own listings" ON public.listings;
CREATE POLICY "Owners can update own listings"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 3. Same for requests
DROP POLICY IF EXISTS "Admins can update any request" ON public.requests;
CREATE POLICY "Admins can update any request"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 4. Same for questions
DROP POLICY IF EXISTS "Admins can update any question" ON public.questions;
CREATE POLICY "Admins can update any question"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 5. Same for regional_posts
DROP POLICY IF EXISTS "Admins can update any regional post" ON public.regional_posts;
CREATE POLICY "Admins can update any regional post"
  ON public.regional_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 6. Make sure your account has the admin role
-- Replace the email below with your actual email if it's different
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'ceilisydney6@gmail.com'
ON CONFLICT DO NOTHING;
