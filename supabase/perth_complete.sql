-- ============================================================
-- CÉILÍ PERTH — COMPLETE DATABASE SETUP (safe to re-run)
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

-- === SUBURB COORDINATES (Perth) ===
CREATE TABLE IF NOT EXISTS public.suburb_coords (
  suburb text PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL
);
ALTER TABLE public.suburb_coords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view suburbs" ON public.suburb_coords;
CREATE POLICY "Anyone can view suburbs" ON public.suburb_coords FOR SELECT USING (true);

INSERT INTO public.suburb_coords (suburb, lat, lng) VALUES
  ('Perth CBD', -31.9505, 115.8605),
  ('Northbridge', -31.9445, 115.8578),
  ('East Perth', -31.9561, 115.8769),
  ('West Perth', -31.9494, 115.8433),
  ('Highgate', -31.9361, 115.8631),
  ('Mount Lawley', -31.9297, 115.8761),
  ('Inglewood', -31.9117, 115.8686),
  ('Bedford', -31.9111, 115.8858),
  ('Maylands', -31.9317, 115.8928),
  ('Bayswater', -31.9214, 115.9153),
  ('Bassendean', -31.9058, 115.9478),
  ('Guildford', -31.8997, 115.9686),
  ('Midland', -31.8897, 115.9933),
  ('Midvale', -31.8811, 115.9964),
  ('Helena Valley', -31.8919, 116.0222),
  ('Kalamunda', -31.9753, 116.0644),
  ('Forrestfield', -31.9811, 116.0103),
  ('High Wycombe', -31.9475, 116.0139),
  ('Leederville', -31.9381, 115.8431),
  ('West Leederville', -31.9414, 115.8375),
  ('Wembley', -31.9303, 115.8256),
  ('Floreat', -31.9267, 115.8083),
  ('City Beach', -31.9264, 115.7692),
  ('Scarborough', -31.8931, 115.7622),
  ('Doubleview', -31.8883, 115.7894),
  ('Woodlands', -31.8853, 115.8156),
  ('Joondanna', -31.9253, 115.8325),
  ('Glendalough', -31.9222, 115.8397),
  ('Herdsman', -31.9172, 115.8253),
  ('Churchlands', -31.9383, 115.8100),
  ('Subiaco', -31.9497, 115.8272),
  ('Shenton Park', -31.9567, 115.8194),
  ('Nedlands', -31.9803, 115.8017),
  ('Crawley', -31.9797, 115.8183),
  ('Karrakatta', -31.9758, 115.8022),
  ('Claremont', -31.9803, 115.7839),
  ('Cottesloe', -31.9994, 115.7553),
  ('North Cottesloe', -31.9906, 115.7536),
  ('Peppermint Grove', -31.9978, 115.7747),
  ('Dalkeith', -31.9908, 115.8089),
  ('Floreat', -31.9267, 115.8083),
  ('South Perth', -31.9780, 115.8686),
  ('Como', -31.9978, 115.8583),
  ('Manning', -32.0028, 115.8606),
  ('Karawara', -31.9983, 115.8753),
  ('Kensington', -31.9781, 115.8786),
  ('Victoria Park', -31.9764, 115.8917),
  ('East Victoria Park', -31.9908, 115.8997),
  ('Carlisle', -31.9878, 115.9147),
  ('Lathlain', -31.9653, 115.9053),
  ('Rivervale', -31.9619, 115.9133),
  ('Burswood', -31.9589, 115.9083),
  ('Belmont', -31.9483, 115.9297),
  ('Cloverdale', -31.9614, 115.9383),
  ('Kewdale', -31.9825, 115.9489),
  ('Welshpool', -31.9983, 115.9428),
  ('St James', -31.9900, 115.8978),
  ('Bentley', -31.9997, 115.9128),
  ('Cannington', -32.0128, 115.9467),
  ('Kenwick', -32.0200, 115.9878),
  ('Thornlie', -32.0494, 115.9711),
  ('Maddington', -32.0489, 115.9933),
  ('Gosnells', -32.0803, 116.0064),
  ('Armadale', -32.1489, 116.0122),
  ('Byford', -32.2147, 116.0025),
  ('Riverton', -32.0225, 115.8789),
  ('Rossmoyne', -32.0356, 115.8744),
  ('Shelley', -32.0311, 115.8856),
  ('Bull Creek', -32.0406, 115.8564),
  ('Murdoch', -32.0650, 115.8375),
  ('Kardinya', -32.0564, 115.8256),
  ('Willetton', -32.0472, 115.8875),
  ('Canning Vale', -32.0711, 115.9272),
  ('Piara Waters', -32.1394, 115.8844),
  ('Harrisdale', -32.1286, 115.8717),
  ('Atwell', -32.1231, 115.8547),
  ('Success', -32.1300, 115.8486),
  ('Aubin Grove', -32.1383, 115.8436),
  ('Jandakot', -32.0978, 115.8806),
  ('Bibra Lake', -32.0894, 115.8253),
  ('Coolbellup', -32.0744, 115.8117),
  ('Spearwood', -32.1092, 115.8022),
  ('Hamilton Hill', -32.0869, 115.8167),
  ('Yangebup', -32.1086, 115.8228),
  ('Beeliar', -32.1378, 115.8208),
  ('Fremantle', -32.0569, 115.7439),
  ('North Fremantle', -32.0367, 115.7461),
  ('East Fremantle', -32.0344, 115.7594),
  ('Beaconsfield', -32.0567, 115.7700),
  ('White Gum Valley', -32.0536, 115.7789),
  ('Hilton', -32.0447, 115.7814),
  ('O''Connor', -32.0422, 115.7939),
  ('Samson', -32.0633, 115.7861),
  ('Palmyra', -32.0439, 115.8117),
  ('Bicton', -32.0258, 115.8017),
  ('Attadale', -32.0175, 115.8089),
  ('Melville', -32.0344, 115.8253),
  ('Myaree', -32.0314, 115.8219),
  ('Booragoon', -32.0328, 115.8383),
  ('Garden City', -32.0367, 115.8453),
  ('Alfred Cove', -32.0200, 115.8183),
  ('Applecross', -31.9981, 115.8314),
  ('Mount Pleasant', -32.0072, 115.8464),
  ('Ardross', -32.0097, 115.8522),
  ('Salter Point', -32.0058, 115.8697),
  ('Morley', -31.8997, 115.8992),
  ('Noranda', -31.8736, 115.8906),
  ('Embleton', -31.9147, 115.9094),
  ('Dianella', -31.8886, 115.8778),
  ('Yokine', -31.9028, 115.8575),
  ('Nollamara', -31.8831, 115.8417),
  ('Balga', -31.8647, 115.8381),
  ('Westminster', -31.8728, 115.8267),
  ('Mirrabooka', -31.8619, 115.8703),
  ('Landsdale', -31.8358, 115.8664),
  ('Malaga', -31.8550, 115.8992),
  ('Alexander Heights', -31.8297, 115.8611),
  ('Marangaroo', -31.8386, 115.8444),
  ('Girrawheen', -31.8528, 115.8392),
  ('Koondoola', -31.8458, 115.8567),
  ('Wanneroo', -31.7494, 115.8094),
  ('Sinagra', -31.7764, 115.8078),
  ('Tapping', -31.7594, 115.7722),
  ('Ashby', -31.7650, 115.7942),
  ('Joondalup', -31.7447, 115.7672),
  ('Edgewater', -31.8008, 115.8119),
  ('Craigie', -31.8208, 115.8058),
  ('Beldon', -31.8022, 115.7869),
  ('Padbury', -31.8306, 115.8258),
  ('Warwick', -31.8406, 115.8300),
  ('Greenwood', -31.8361, 115.8144),
  ('Duncraig', -31.8472, 115.8017),
  ('Carine', -31.8681, 115.8206),
  ('Gwelup', -31.8875, 115.8003),
  ('Karrinyup', -31.8703, 115.7989),
  ('Scarborough', -31.8931, 115.7622),
  ('Trigg', -31.8722, 115.7661),
  ('Hillarys', -31.8072, 115.7383),
  ('Kallaroo', -31.7958, 115.7700),
  ('Mullaloo', -31.7875, 115.7503),
  ('Ocean Reef', -31.7711, 115.7528),
  ('Connolly', -31.7369, 115.7572),
  ('Currambine', -31.7367, 115.7372),
  ('Iluka', -31.7294, 115.7286),
  ('Burns Beach', -31.7194, 115.7317),
  ('Clarkson', -31.6883, 115.7139),
  ('Merriwa', -31.6692, 115.7328),
  ('Mindarie', -31.6856, 115.7064),
  ('Quinns Rocks', -31.6697, 115.7011),
  ('Butler', -31.6494, 115.7083),
  ('Ridgewood', -31.6550, 115.7300),
  ('Alkimos', -31.6411, 115.7119),
  ('Eglinton', -31.6197, 115.7008),
  ('Eden Hill', -31.8978, 115.9206),
  ('Redcliffe', -31.9358, 115.9486),
  ('Ascot', -31.9283, 115.9303),
  ('Ashfield', -31.9197, 115.9411),
  ('Bassendean', -31.9058, 115.9478),
  ('Rockingham', -32.2783, 115.7256),
  ('Safety Bay', -32.3083, 115.7308),
  ('Mandurah', -32.5272, 115.7228),
  ('Baldivis', -32.3211, 115.8358),
  ('Port Kennedy', -32.3631, 115.7600),
  ('Warnbro', -32.3358, 115.7600),
  ('Secret Harbour', -32.3844, 115.7678),
  ('Golden Bay', -32.4094, 115.7731),
  ('Singleton', -32.4308, 115.7783)
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
