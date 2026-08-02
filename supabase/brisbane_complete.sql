-- ============================================================
-- CÉILÍ BRISBANE — COMPLETE DATABASE SETUP (safe to re-run)
-- ============================================================

-- === TYPES ===
DO $$ BEGIN
  CREATE TYPE public.listing_category AS ENUM ('job','room','sublet','lease_takeover','for_sale','service','event','car','sports_wellness');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === PROFILES (must exist before questions policies reference it) ===
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === LISTINGS ===
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category public.listing_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC,
  suburb TEXT,
  contact_name TEXT NOT NULL,
  image_url TEXT,
  event_date TIMESTAMPTZ,
  job_type TEXT,
  item_type TEXT,
  link_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_listings_category_created ON public.listings (category, created_at DESC);

DROP POLICY IF EXISTS "Anyone can view listings" ON public.listings;
CREATE POLICY "Anyone can view listings" ON public.listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create listings" ON public.listings;
DROP POLICY IF EXISTS "Anon can create listings" ON public.listings;
CREATE POLICY "Anon can create listings" ON public.listings FOR INSERT TO anon WITH CHECK (owner_id IS NULL);
DROP POLICY IF EXISTS "Authenticated can create listings" ON public.listings;
CREATE POLICY "Authenticated can create listings" ON public.listings FOR INSERT TO authenticated
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());
DROP POLICY IF EXISTS "Owners can update own listings" ON public.listings;
CREATE POLICY "Owners can update own listings" ON public.listings FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can delete own listings" ON public.listings;
CREATE POLICY "Owners can delete own listings" ON public.listings FOR DELETE USING (auth.uid() = owner_id);

-- === QUESTIONS & ANSWERS ===
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  author_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS answers_question_id_idx ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS questions_created_at_idx ON public.questions(created_at DESC);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create questions" ON public.questions;
CREATE POLICY "Anyone can create questions" ON public.questions FOR INSERT TO public
WITH CHECK (
  (author_name IS NULL OR (length(author_name) <= 60 AND length(trim(author_name)) > 0))
  AND (author_name IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.display_name) = lower(trim(questions.author_name))
      AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  ))
);
DROP POLICY IF EXISTS "Anyone can view answers" ON public.answers;
CREATE POLICY "Anyone can view answers" ON public.answers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create answers" ON public.answers;
CREATE POLICY "Anyone can create answers" ON public.answers FOR INSERT TO public
WITH CHECK (
  (author_name IS NULL OR (length(author_name) <= 60 AND length(trim(author_name)) > 0))
  AND (author_name IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.display_name) = lower(trim(answers.author_name))
      AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  ))
);

-- === FAVOURITES, REPORTS ===
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own favourites" ON public.favourites;
CREATE POLICY "Users view own favourites" ON public.favourites FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users add own favourites" ON public.favourites;
CREATE POLICY "Users add own favourites" ON public.favourites FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users remove own favourites" ON public.favourites;
CREATE POLICY "Users remove own favourites" ON public.favourites FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.reports;
CREATE POLICY "Anyone can submit reports" ON public.reports FOR INSERT WITH CHECK (true);

-- === USER ROLES ===
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Mods can view reports" ON public.reports;
CREATE POLICY "Mods can view reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Mods can delete reports" ON public.reports;
CREATE POLICY "Mods can delete reports" ON public.reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Mods can delete any listing" ON public.listings;
CREATE POLICY "Mods can delete any listing" ON public.listings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- === SUBURB COORDINATES (Brisbane) ===
CREATE TABLE IF NOT EXISTS public.suburb_coords (
  suburb text PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL
);
ALTER TABLE public.suburb_coords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view suburbs" ON public.suburb_coords;
CREATE POLICY "Anyone can view suburbs" ON public.suburb_coords FOR SELECT USING (true);

INSERT INTO public.suburb_coords (suburb, lat, lng) VALUES
  ('Brisbane CBD', -27.4698, 153.0251),
  ('South Brisbane', -27.4797, 153.0172),
  ('West End', -27.4869, 153.0039),
  ('Fortitude Valley', -27.4564, 153.0364),
  ('New Farm', -27.4661, 153.0500),
  ('Teneriffe', -27.4594, 153.0469),
  ('Newstead', -27.4494, 153.0461),
  ('Spring Hill', -27.4600, 153.0228),
  ('Kelvin Grove', -27.4497, 153.0058),
  ('Red Hill', -27.4569, 153.0097),
  ('Paddington', -27.4614, 152.9908),
  ('Milton', -27.4711, 153.0053),
  ('Auchenflower', -27.4742, 152.9983),
  ('Toowong', -27.4847, 152.9858),
  ('St Lucia', -27.5000, 153.0042),
  ('Indooroopilly', -27.5061, 152.9764),
  ('Taringa', -27.4936, 152.9836),
  ('Bardon', -27.4617, 152.9808),
  ('The Gap', -27.4481, 152.9458),
  ('Ashgrove', -27.4467, 152.9789),
  ('Herston', -27.4511, 153.0183),
  ('Bowen Hills', -27.4467, 153.0347),
  ('Windsor', -27.4375, 153.0336),
  ('Lutwyche', -27.4269, 153.0297),
  ('Kedron', -27.4139, 153.0303),
  ('Chermside', -27.3878, 153.0411),
  ('Stafford', -27.4197, 153.0136),
  ('Grange', -27.4153, 153.0042),
  ('Gordon Park', -27.4225, 153.0197),
  ('Newmarket', -27.4392, 152.9983),
  ('Wilston', -27.4375, 153.0019),
  ('Mitchelton', -27.4175, 152.9769),
  ('Everton Park', -27.4253, 152.9886),
  ('Ferny Grove', -27.4147, 152.9408),
  ('Alderley', -27.4358, 153.0053),
  ('Enoggera', -27.4303, 152.9686),
  ('Keperra', -27.4147, 152.9567),
  ('Wooloowin', -27.4294, 153.0439),
  ('Clayfield', -27.4294, 153.0694),
  ('Nundah', -27.4103, 153.0706),
  ('Hendra', -27.4347, 153.0761),
  ('Eagle Farm', -27.4358, 153.0917),
  ('Hamilton', -27.4414, 153.0819),
  ('Ascot', -27.4464, 153.0811),
  ('Albion', -27.4411, 153.0472),
  ('Woolloongabba', -27.4997, 153.0408),
  ('Kangaroo Point', -27.4897, 153.0406),
  ('East Brisbane', -27.4847, 153.0456),
  ('Norman Park', -27.4983, 153.0581),
  ('Camp Hill', -27.5097, 153.0606),
  ('Coorparoo', -27.5061, 153.0681),
  ('Greenslopes', -27.5111, 153.0442),
  ('Holland Park', -27.5147, 153.0567),
  ('Holland Park West', -27.5178, 153.0519),
  ('Carindale', -27.5103, 153.1061),
  ('Mount Gravatt', -27.5503, 153.0764),
  ('Mount Gravatt East', -27.5392, 153.0869),
  ('Upper Mount Gravatt', -27.5628, 153.0786),
  ('Tarragindi', -27.5278, 153.0428),
  ('Moorooka', -27.5344, 153.0297),
  ('Rocklea', -27.5361, 153.0122),
  ('Salisbury', -27.5442, 153.0253),
  ('Nathan', -27.5442, 153.0508),
  ('Sunnybank', -27.5794, 153.0572),
  ('Sunnybank Hills', -27.5842, 153.0531),
  ('Robertson', -27.5597, 153.0647),
  ('Coopers Plains', -27.5619, 153.0408),
  ('Acacia Ridge', -27.5858, 153.0197),
  ('Archerfield', -27.5697, 153.0117),
  ('Forest Lake', -27.6119, 152.9708),
  ('Richlands', -27.5958, 152.9753),
  ('Inala', -27.5914, 152.9806),
  ('Durack', -27.5911, 152.9678),
  ('Darra', -27.5661, 152.9686),
  ('Sinnamon Park', -27.5514, 152.9619),
  ('Jindalee', -27.5422, 152.9489),
  ('Oxley', -27.5639, 152.9781),
  ('Corinda', -27.5583, 152.9847),
  ('Graceville', -27.5481, 153.0036),
  ('Sherwood', -27.5394, 152.9997),
  ('Chelmer', -27.5272, 152.9947),
  ('Tennyson', -27.5097, 152.9836),
  ('Yeronga', -27.5069, 153.0011),
  ('Annerley', -27.5189, 153.0394),
  ('Fairfield', -27.5169, 153.0303),
  ('Highgate Hill', -27.4947, 153.0183),
  ('Dutton Park', -27.4947, 153.0294),
  ('Buranda', -27.4997, 153.0367),
  ('Wishart', -27.5697, 153.1006),
  ('MacGregor', -27.5644, 153.0753),
  ('Mansfield', -27.5544, 153.0936),
  ('Eight Mile Plains', -27.5831, 153.0972),
  ('Runcorn', -27.5903, 153.0722),
  ('Parkinson', -27.6083, 153.0678),
  ('Calamvale', -27.6136, 153.0578),
  ('Algester', -27.6178, 153.0478),
  ('Kuraby', -27.6203, 153.1158),
  ('Stretton', -27.5981, 153.0822),
  ('Rochedale', -27.5839, 153.1208),
  ('Underwood', -27.6039, 153.1197),
  ('Springwood', -27.6139, 153.1108),
  ('Daisy Hill', -27.6256, 153.1211),
  ('Shailer Park', -27.6225, 153.1283),
  ('Logan Central', -27.6439, 153.1161),
  ('Woodridge', -27.6403, 153.1175),
  ('Kingston', -27.6556, 153.1283),
  ('Slacks Creek', -27.6483, 153.1161),
  ('Browns Plains', -27.6572, 153.0608),
  ('Loganholme', -27.6619, 153.1675),
  ('Beenleigh', -27.7236, 153.1983),
  ('Pallara', -27.6014, 153.0283),
  ('Heathwood', -27.6378, 153.0378),
  ('Drewvale', -27.6178, 153.0378),
  ('Nudgee', -27.3858, 153.0978),
  ('Northgate', -27.3892, 153.0733),
  ('Virginia', -27.3894, 153.0594),
  ('Geebung', -27.3822, 153.0472),
  ('Zillmere', -27.3717, 153.0525),
  ('Boondall', -27.3519, 153.0708),
  ('Bracken Ridge', -27.3431, 153.0275),
  ('Brighton', -27.2983, 153.0589),
  ('Sandgate', -27.3236, 153.0669),
  ('Shorncliffe', -27.3311, 153.0783),
  ('Deagon', -27.3394, 153.0800),
  ('Bald Hills', -27.3289, 153.0136),
  ('Strathpine', -27.3019, 152.9881),
  ('Petrie', -27.2653, 152.9761),
  ('North Lakes', -27.2303, 153.0208),
  ('Kallangur', -27.2942, 153.0044),
  ('Mango Hill', -27.2531, 153.0311),
  ('Redcliffe', -27.2328, 153.1069),
  ('Kippa-Ring', -27.2175, 153.1008),
  ('Clontarf', -27.2453, 153.1028),
  ('Woody Point', -27.2611, 153.1011),
  ('Margate', -27.2492, 153.0964),
  ('Lawnton', -27.2908, 152.9869),
  ('Eatons Hill', -27.3419, 152.9611),
  ('Albany Creek', -27.3583, 152.9597),
  ('Bridgeman Downs', -27.3733, 153.0006),
  ('Warner', -27.3453, 152.9786),
  ('Brendale', -27.3244, 152.9803),
  ('Samford', -27.3700, 152.8883),
  ('Pullenvale', -27.5003, 152.8819),
  ('Kenmore', -27.5083, 152.9411),
  ('Kenmore Hills', -27.4969, 152.9281),
  ('Chapel Hill', -27.5039, 152.9600),
  ('Fig Tree Pocket', -27.5183, 152.9669),
  ('Pinjarra Hills', -27.5458, 152.9239),
  ('Moggill', -27.5722, 152.8808),
  ('Bellbowrie', -27.5531, 152.8917),
  ('Riverhills', -27.5414, 152.9347)
ON CONFLICT (suburb) DO NOTHING;

-- === ADMIN ACTIVITY LOG ===
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_actor ON public.admin_activity_log (actor_id);
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mods can view activity log" ON public.admin_activity_log;
CREATE POLICY "Mods can view activity log" ON public.admin_activity_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
DROP POLICY IF EXISTS "Mods can insert activity log" ON public.admin_activity_log;
CREATE POLICY "Mods can insert activity log" ON public.admin_activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)));

DROP POLICY IF EXISTS "Mods can delete any question" ON public.questions;
CREATE POLICY "Mods can delete any question" ON public.questions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
DROP POLICY IF EXISTS "Mods can delete any answer" ON public.answers;
CREATE POLICY "Mods can delete any answer" ON public.answers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- === STORAGE BUCKETS ===
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
WHERE id = 'listing-images';

UPDATE storage.buckets SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp']
WHERE id = 'avatars';

DROP POLICY IF EXISTS "Listing images are publicly readable" ON storage.objects;
CREATE POLICY "Listing images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "Authenticated users can upload listing images" ON storage.objects;
CREATE POLICY "Authenticated users can upload listing images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-images' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE((metadata->>'mimetype'), '')) = ANY (ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
  AND COALESCE(((metadata->>'size'))::bigint, 0) <= 10485760
);

DROP POLICY IF EXISTS "Authenticated users can update their listing images" ON storage.objects;
CREATE POLICY "Authenticated users can update their listing images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'listing-images' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (
  bucket_id = 'listing-images' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE((metadata->>'mimetype'), '')) = ANY (ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
  AND COALESCE(((metadata->>'size'))::bigint, 0) <= 10485760
);

DROP POLICY IF EXISTS "Owners can delete their listing images" ON storage.objects;
CREATE POLICY "Owners can delete their listing images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Anyone can upload to guest folder" ON storage.objects;
CREATE POLICY "Anyone can upload to guest folder" ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'listing-images' AND (storage.foldername(name))[1] = 'guest'
  AND lower(coalesce(metadata->>'mimetype', '')) IN ('image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif')
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
CREATE POLICY "Avatars are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp','gif'])
  AND COALESCE(((metadata->>'size')::bigint), 0) <= 5242880
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (
  bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp','gif'])
  AND COALESCE(((metadata->>'size')::bigint), 0) <= 5242880
);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- === CONVERSATIONS + MESSAGES ===
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  starter_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, starter_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_starter ON public.conversations(starter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON public.conversations(owner_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view conversations" ON public.conversations;
CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = starter_id OR auth.uid() = owner_id);
DROP POLICY IF EXISTS "Starter can create conversation" ON public.conversations;
CREATE POLICY "Starter can create conversation" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = starter_id AND starter_id <> owner_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = conversations.owner_id AND l.owner_id IS NOT NULL)
  );
DROP POLICY IF EXISTS "Participants update conversation" ON public.conversations;
CREATE POLICY "Participants update conversation" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = starter_id OR auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view messages" ON public.messages;
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid())));
DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bump_conversation ON public.messages;
CREATE TRIGGER trg_bump_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;

-- === LISTING CONTACTS ===
CREATE TABLE IF NOT EXISTS public.listing_contacts (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  contact_email text,
  contact_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or participant can view contact" ON public.listing_contacts;
CREATE POLICY "Owner or participant can view contact" ON public.listing_contacts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.listing_id = listing_contacts.listing_id AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid()))
  );
DROP POLICY IF EXISTS "Owner can insert contact" ON public.listing_contacts;
CREATE POLICY "Owner can insert contact" ON public.listing_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Owner can update contact" ON public.listing_contacts;
CREATE POLICY "Owner can update contact" ON public.listing_contacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Owner or mod can delete contact" ON public.listing_contacts;
CREATE POLICY "Owner or mod can delete contact" ON public.listing_contacts FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role)
  );
DROP POLICY IF EXISTS "Anon can insert contact for ownerless listing" ON public.listing_contacts;
CREATE POLICY "Anon can insert contact for ownerless listing" ON public.listing_contacts FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id IS NULL));

-- === REQUESTS ===
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.listing_category NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  suburb text,
  contact_name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  link_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '60 days')
);
CREATE INDEX IF NOT EXISTS idx_requests_category_created ON public.requests (category, created_at DESC);
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view requests" ON public.requests;
CREATE POLICY "Anyone can view requests" ON public.requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anon can create requests" ON public.requests;
CREATE POLICY "Anon can create requests" ON public.requests FOR INSERT TO anon WITH CHECK (owner_id IS NULL);
DROP POLICY IF EXISTS "Authenticated can create requests" ON public.requests;
CREATE POLICY "Authenticated can create requests" ON public.requests FOR INSERT TO authenticated WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());
DROP POLICY IF EXISTS "Owners can update own requests" ON public.requests;
CREATE POLICY "Owners can update own requests" ON public.requests FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can delete own requests" ON public.requests;
CREATE POLICY "Owners can delete own requests" ON public.requests FOR DELETE TO authenticated USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Mods can delete any request" ON public.requests;
CREATE POLICY "Mods can delete any request" ON public.requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- === REGIONAL POSTS ===
CREATE TABLE IF NOT EXISTS public.regional_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  author_name text,
  category text NOT NULL CHECK (category IN ('jobs','housing','general')),
  region text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  link_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regional_posts_created ON public.regional_posts (created_at DESC);
ALTER TABLE public.regional_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view regional posts" ON public.regional_posts;
CREATE POLICY "Anyone can view regional posts" ON public.regional_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create regional posts" ON public.regional_posts;
CREATE POLICY "Authenticated users can create regional posts" ON public.regional_posts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Owners can update own regional posts" ON public.regional_posts;
CREATE POLICY "Owners can update own regional posts" ON public.regional_posts FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can delete own regional posts" ON public.regional_posts;
CREATE POLICY "Owners can delete own regional posts" ON public.regional_posts FOR DELETE
  USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- === REGIONAL REPLIES ===
CREATE TABLE IF NOT EXISTS public.regional_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.regional_posts(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regional_replies_post ON public.regional_replies (post_id, created_at);
ALTER TABLE public.regional_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view regional replies" ON public.regional_replies;
CREATE POLICY "Anyone can view regional replies" ON public.regional_replies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can create regional replies" ON public.regional_replies;
CREATE POLICY "Authenticated can create regional replies" ON public.regional_replies FOR INSERT TO authenticated WITH CHECK (true);

-- === PAGE VIEWS ===
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views" ON page_views FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read page views" ON public.page_views;
CREATE POLICY "Admins can read page views" ON page_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- === GRANTS ===
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_contacts TO anon, authenticated;
GRANT INSERT ON public.listing_contacts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_posts TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.regional_replies TO anon, authenticated;
GRANT SELECT, INSERT ON public.questions TO anon, authenticated;
GRANT DELETE, UPDATE ON public.questions TO authenticated;
GRANT SELECT, INSERT ON public.answers TO anon, authenticated;
GRANT DELETE ON public.answers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.favourites TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.reports TO anon, authenticated;
GRANT DELETE ON public.reports TO authenticated;
GRANT SELECT ON public.suburb_coords TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT ON public.admin_activity_log TO authenticated;
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;

-- === MISSING COLUMNS (patch) ===
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS ticket_url TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- === BLOCKED USERS ===
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own blocks" ON public.blocked_users;
CREATE POLICY "Users view own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Users can block" ON public.blocked_users;
CREATE POLICY "Users can block" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Users can unblock" ON public.blocked_users;
CREATE POLICY "Users can unblock" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;

-- === PUSH TOKENS ===
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON public.push_tokens TO authenticated;

-- === ADMIN UPDATE POLICIES ===
DROP POLICY IF EXISTS "Admins can update any listing" ON public.listings;
CREATE POLICY "Admins can update any listing" ON public.listings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
DROP POLICY IF EXISTS "Admins can update any request" ON public.requests;
CREATE POLICY "Admins can update any request" ON public.requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
DROP POLICY IF EXISTS "Admins can update any question" ON public.questions;
CREATE POLICY "Admins can update any question" ON public.questions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
DROP POLICY IF EXISTS "Admins can update any regional post" ON public.regional_posts;
CREATE POLICY "Admins can update any regional post" ON public.regional_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
