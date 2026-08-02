-- Fix missing UPDATE grants and RLS policies so owners can edit their own posts.

-- ============================================================
-- requests: add UPDATE grant + owner update policy
-- ============================================================
GRANT UPDATE ON public.requests TO authenticated;

DROP POLICY IF EXISTS "Owners can update own requests" ON public.requests;
CREATE POLICY "Owners can update own requests"
  ON public.requests FOR UPDATE
  USING (auth.uid() = owner_id);

-- ============================================================
-- questions: add UPDATE grant + authenticated update policy
-- (questions have no owner_id column; client-side isMyPost guards the UI)
-- ============================================================
GRANT UPDATE ON public.questions TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can update questions" ON public.questions;
CREATE POLICY "Authenticated users can update questions"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- regional_posts: ensure full grants + RLS policies exist
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_posts TO anon, authenticated;

-- Enable RLS if not already on
ALTER TABLE public.regional_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view regional posts" ON public.regional_posts;
CREATE POLICY "Anyone can view regional posts"
  ON public.regional_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create regional posts" ON public.regional_posts;
CREATE POLICY "Authenticated users can create regional posts"
  ON public.regional_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can update own regional posts" ON public.regional_posts;
CREATE POLICY "Owners can update own regional posts"
  ON public.regional_posts FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own regional posts" ON public.regional_posts;
CREATE POLICY "Owners can delete own regional posts"
  ON public.regional_posts FOR DELETE
  USING (auth.uid() = owner_id OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

-- regional_replies: ensure grants exist too
GRANT SELECT, INSERT, DELETE ON public.regional_replies TO anon, authenticated;
