-- Add moderation status to all post types.
-- Existing content is approved immediately so nothing breaks.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.regional_posts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Approve all pre-existing content
UPDATE public.listings      SET status = 'approved' WHERE status = 'pending';
UPDATE public.requests      SET status = 'approved' WHERE status = 'pending';
UPDATE public.questions     SET status = 'approved' WHERE status = 'pending';
UPDATE public.regional_posts SET status = 'approved' WHERE status = 'pending';

-- Ensure authenticated users can update status (admins will use this)
GRANT UPDATE ON public.listings       TO authenticated;
GRANT UPDATE ON public.requests       TO authenticated;
GRANT UPDATE ON public.questions      TO authenticated;
GRANT UPDATE ON public.regional_posts TO authenticated;
