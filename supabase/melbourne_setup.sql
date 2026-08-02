-- ============================================================
-- CÉILÍ MELBOURNE — COMPLETE DATABASE SETUP
-- Run this in one go in the Supabase SQL Editor
-- ============================================================

-- === 1. BASE LISTINGS TABLE ===
CREATE TYPE public.listing_category AS ENUM ('job','room','sublet','lease_takeover','for_sale','service','event');

CREATE TABLE public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category public.listing_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC,
  suburb TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  image_url TEXT,
  event_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listings"
  ON public.listings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create listings"
  ON public.listings FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_listings_category_created ON public.listings (category, created_at DESC);

-- === 2. JOB TYPE COLUMN ===
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS job_type text;
CREATE INDEX IF NOT EXISTS listings_job_type_idx ON public.listings (job_type) WHERE job_type IS NOT NULL;

-- === 3. CAR CATEGORY + ITEM TYPE ===
ALTER TYPE public.listing_category ADD VALUE IF NOT EXISTS 'car';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS item_type text;
CREATE INDEX IF NOT EXISTS listings_item_type_idx ON public.listings (item_type) WHERE item_type IS NOT NULL;

-- === 4. QUESTIONS & ANSWERS ===
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX answers_question_id_idx ON public.answers(question_id);
CREATE INDEX questions_created_at_idx ON public.questions(created_at DESC);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Anyone can create questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view answers" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Anyone can create answers" ON public.answers FOR INSERT WITH CHECK (true);

-- === 5. PROFILES, FAVOURITES, REPORTS + OWNER ON LISTINGS ===
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own favourites" ON public.favourites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users add own favourites" ON public.favourites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own favourites" ON public.favourites FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit reports" ON public.reports FOR INSERT WITH CHECK (true);

ALTER TABLE public.listings ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE POLICY "Owners can update own listings" ON public.listings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own listings" ON public.listings FOR DELETE USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === 6. IMAGE URLS, EXPIRES AT, STORAGE BUCKETS ===
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.listings SET expires_at = created_at + INTERVAL '60 days' WHERE expires_at IS NULL;
ALTER TABLE public.listings ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '60 days');
ALTER TABLE public.listings ALTER COLUMN expires_at SET NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Listing images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their listing images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their listing images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can upload to guest folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = 'guest');

-- === 7. ROLES + SUBURB COORDS ===
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Mods can view reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Mods can delete reports" ON public.reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Mods can delete any listing" ON public.listings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Melbourne suburb coordinates
CREATE TABLE public.suburb_coords (
  suburb text PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL
);
ALTER TABLE public.suburb_coords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view suburbs" ON public.suburb_coords FOR SELECT USING (true);

INSERT INTO public.suburb_coords (suburb, lat, lng) VALUES
  ('Melbourne CBD', -37.8136, 144.9631),
  ('Docklands', -37.8143, 144.9458),
  ('South Melbourne', -37.8347, 144.9578),
  ('Port Melbourne', -37.8339, 144.9403),
  ('North Melbourne', -37.8009, 144.9489),
  ('West Melbourne', -37.8061, 144.9444),
  ('Carlton', -37.8008, 144.9671),
  ('Fitzroy', -37.7994, 144.9795),
  ('Fitzroy North', -37.7856, 144.9825),
  ('Collingwood', -37.8039, 144.9864),
  ('Abbotsford', -37.8069, 144.9978),
  ('Richmond', -37.8194, 144.9989),
  ('Cremorne', -37.8278, 145.0047),
  ('Prahran', -37.8500, 144.9944),
  ('Windsor', -37.8561, 144.9939),
  ('South Yarra', -37.8400, 144.9936),
  ('Toorak', -37.8439, 145.0197),
  ('Hawthorn', -37.8239, 145.0325),
  ('Hawthorn East', -37.8278, 145.0464),
  ('Kew', -37.8081, 145.0314),
  ('Camberwell', -37.8369, 145.0656),
  ('Canterbury', -37.8322, 145.0736),
  ('Balwyn', -37.8119, 145.0736),
  ('Balwyn North', -37.7992, 145.0858),
  ('Box Hill', -37.8194, 145.1219),
  ('Box Hill South', -37.8333, 145.1214),
  ('Doncaster', -37.7878, 145.1264),
  ('Doncaster East', -37.7936, 145.1550),
  ('Ringwood', -37.8181, 145.2278),
  ('Ringwood East', -37.8194, 145.2481),
  ('Burwood', -37.8428, 145.1153),
  ('Glen Waverley', -37.8786, 145.1636),
  ('Nunawading', -37.8186, 145.1800),
  ('Brunswick', -37.7700, 144.9617),
  ('Brunswick East', -37.7739, 144.9808),
  ('Brunswick West', -37.7700, 144.9483),
  ('Northcote', -37.7728, 144.9956),
  ('Preston', -37.7464, 145.0069),
  ('Reservoir', -37.7189, 145.0083),
  ('Coburg', -37.7439, 144.9647),
  ('Coburg North', -37.7283, 144.9650),
  ('Fawkner', -37.7103, 144.9622),
  ('Glenroy', -37.7131, 144.9269),
  ('Broadmeadows', -37.6847, 144.9183),
  ('Craigieburn', -37.6031, 144.9417),
  ('Epping', -37.6442, 145.0236),
  ('South Morang', -37.6506, 145.0669),
  ('Mill Park', -37.6722, 145.0603),
  ('Lalor', -37.6758, 145.0139),
  ('Thomastown', -37.7028, 145.0383),
  ('Essendon', -37.7519, 144.9158),
  ('Essendon North', -37.7389, 144.9150),
  ('Moonee Ponds', -37.7647, 144.9228),
  ('Flemington', -37.7886, 144.9233),
  ('Kensington', -37.7947, 144.9281),
  ('Ascot Vale', -37.7728, 144.9119),
  ('Footscray', -37.8003, 144.9003),
  ('Yarraville', -37.8197, 144.8900),
  ('Seddon', -37.8064, 144.8881),
  ('Williamstown', -37.8625, 144.8953),
  ('Newport', -37.8453, 144.9019),
  ('Altona', -37.8683, 144.8303),
  ('Altona North', -37.8417, 144.8483),
  ('Laverton', -37.8669, 144.7739),
  ('Sunshine', -37.7900, 144.8308),
  ('Sunshine North', -37.7733, 144.8289),
  ('Sunshine West', -37.8036, 144.8200),
  ('St Kilda', -37.8636, 144.9808),
  ('St Kilda East', -37.8664, 145.0019),
  ('Elwood', -37.8797, 144.9858),
  ('Balaclava', -37.8608, 144.9944),
  ('Elsternwick', -37.8858, 145.0033),
  ('Caulfield', -37.8772, 145.0244),
  ('Caulfield North', -37.8706, 145.0219),
  ('Caulfield South', -37.8889, 145.0292),
  ('Carnegie', -37.8922, 145.0450),
  ('Murrumbeena', -37.8894, 145.0561),
  ('Oakleigh', -37.8994, 145.0925),
  ('Oakleigh South', -37.9178, 145.0975),
  ('Clayton', -37.9228, 145.1197),
  ('Cheltenham', -37.9531, 145.0569),
  ('Moorabbin', -37.9392, 145.0478),
  ('Bentleigh', -37.9189, 145.0392),
  ('Bentleigh East', -37.9272, 145.0603),
  ('Brighton', -37.9150, 144.9878),
  ('Brighton East', -37.9158, 145.0014),
  ('Sandringham', -37.9489, 144.9919),
  ('Mentone', -37.9856, 145.0617),
  ('Mordialloc', -38.0025, 145.0869),
  ('Dandenong', -37.9878, 145.2153),
  ('Dandenong North', -37.9711, 145.2142),
  ('Springvale', -37.9492, 145.1511),
  ('Berwick', -38.0347, 145.3561),
  ('Narre Warren', -38.0281, 145.3044),
  ('Cranbourne', -38.1133, 145.2819),
  ('Frankston', -38.1439, 145.1183),
  ('Frankston North', -38.1214, 145.1108),
  ('Frankston South', -38.1708, 145.1256),
  ('Mornington', -38.2183, 145.0383),
  ('Mount Martha', -38.2608, 145.0236),
  ('Mount Eliza', -38.1869, 145.0922),
  ('Rosebud', -38.3567, 144.8981),
  ('Point Cook', -37.8983, 144.7403),
  ('Hoppers Crossing', -37.8761, 144.7131),
  ('Werribee', -37.9033, 144.6611),
  ('Tarneit', -37.8258, 144.6919),
  ('Truganina', -37.8428, 144.7356),
  ('Melton', -37.6847, 144.5781),
  ('Melton South', -37.7031, 144.5822),
  ('Pakenham', -38.0756, 145.4886),
  ('Officer', -38.0647, 145.4083),
  ('Glen Iris', -37.8594, 145.0572),
  ('Malvern', -37.8622, 145.0375),
  ('Malvern East', -37.8678, 145.0594),
  ('Armadale', -37.8561, 145.0186),
  ('Glen Huntly', -37.8933, 145.0186),
  ('Chadstone', -37.8936, 145.0811),
  ('Ashwood', -37.8697, 145.0986),
  ('Mount Waverley', -37.8714, 145.1297),
  ('Wheelers Hill', -37.9050, 145.1883),
  ('Rowville', -37.9297, 145.2297),
  ('Ferntree Gully', -37.8831, 145.2942),
  ('Bayswater', -37.8506, 145.2678),
  ('Croydon', -37.7944, 145.2803),
  ('Mitcham', -37.8172, 145.1983),
  ('Vermont', -37.8389, 145.1969),
  ('Forest Hill', -37.8411, 145.1661);

-- === 8. ADMIN ACTIVITY LOG ===
CREATE TABLE public.admin_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);
CREATE INDEX idx_admin_activity_log_actor ON public.admin_activity_log (actor_id);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods can view activity log"
ON public.admin_activity_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Mods can insert activity log"
ON public.admin_activity_log FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
);

-- === 9. SECURITY: REVOKE + MOD DELETE ===
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

CREATE POLICY "Mods can delete any question" ON public.questions FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Mods can delete any answer" ON public.answers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
WHERE id = 'listing-images';

-- === 10. GRANT EXECUTE HAS_ROLE ===
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- === 11. CONVERSATIONS + MESSAGES ===
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  starter_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, starter_id)
);

CREATE INDEX idx_conversations_starter ON public.conversations(starter_id);
CREATE INDEX idx_conversations_owner ON public.conversations(owner_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT TO authenticated
USING (auth.uid() = starter_id OR auth.uid() = owner_id);

CREATE POLICY "Starter can create conversation" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = starter_id AND starter_id <> owner_id);

CREATE POLICY "Participants update conversation" ON public.conversations FOR UPDATE TO authenticated
USING (auth.uid() = starter_id OR auth.uid() = owner_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view messages" ON public.messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = conversation_id AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid())
));

CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_bump_conversation
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- === 12. AVATARS BUCKET ===
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','image/avif'],
    file_size_limit = 10485760
WHERE id = 'listing-images';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','image/avif'],
    file_size_limit = 5242880
WHERE id = 'avatars';

-- === 13. LISTING CONTACTS ===
CREATE TABLE public.listing_contacts (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  contact_email text,
  contact_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.listing_contacts (listing_id, contact_email, contact_phone)
SELECT id, contact_email, contact_phone FROM public.listings
WHERE contact_email IS NOT NULL OR contact_phone IS NOT NULL;

ALTER TABLE public.listings DROP COLUMN IF EXISTS contact_email;
ALTER TABLE public.listings DROP COLUMN IF EXISTS contact_phone;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_contacts TO authenticated;
GRANT ALL ON public.listing_contacts TO service_role;

ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contacts" ON public.listing_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can insert contact" ON public.listing_contacts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid()));

CREATE POLICY "Owner can update contact" ON public.listing_contacts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid()));

CREATE POLICY "Owner or mod can delete contact" ON public.listing_contacts FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

DROP POLICY IF EXISTS "Anyone can create listings" ON public.listings;

CREATE POLICY "Anon can create listings" ON public.listings FOR INSERT TO anon WITH CHECK (owner_id IS NULL);
CREATE POLICY "Authenticated can create listings" ON public.listings FOR INSERT TO authenticated
WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

-- === 14. CONVERSATIONS SECURITY FIX ===
DROP POLICY IF EXISTS "Starter can create conversation" ON public.conversations;

CREATE POLICY "Starter can create conversation" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = starter_id
  AND starter_id <> owner_id
  AND EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.owner_id = conversations.owner_id AND l.owner_id IS NOT NULL
  )
);

-- === 15. SECURITY HARDENING ===
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "Authenticated can view contacts" ON public.listing_contacts;
CREATE POLICY "Owner or participant can view contact" ON public.listing_contacts FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.listing_id = listing_contacts.listing_id
      AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid())
  )
);

-- === 16. SPORTS_WELLNESS CATEGORY ===
ALTER TYPE public.listing_category ADD VALUE IF NOT EXISTS 'sports_wellness';

-- === 17. QUESTIONS/ANSWERS IMPERSONATION FIX + GUEST UPLOAD ===
DROP POLICY IF EXISTS "Anyone can create questions" ON public.questions;
CREATE POLICY "Anyone can create questions" ON public.questions FOR INSERT TO public
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
CREATE POLICY "Anyone can create answers" ON public.answers FOR INSERT TO public
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

DROP POLICY IF EXISTS "Anyone can upload to guest folder" ON storage.objects;
CREATE POLICY "Anyone can upload to guest folder" ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = 'guest'
  AND lower(coalesce(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
);

-- === 18. AVATAR BUCKET TIGHTENING ===
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 5242880
WHERE id = 'avatars';

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp','gif'])
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  AND COALESCE(((metadata ->> 'size')::bigint), 0) <= 5242880
);

CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp','gif'])
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  AND COALESCE(((metadata ->> 'size')::bigint), 0) <= 5242880
);

-- === 19. REALTIME ANSWERS ===
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;

-- === 20. LISTING IMAGE POLICIES UPDATE ===
DROP POLICY IF EXISTS "Authenticated users can upload listing images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their listing images" ON storage.objects;

CREATE POLICY "Authenticated users can upload listing images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE((metadata->>'mimetype'), '')) = ANY (ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'
  ])
  AND COALESCE(((metadata->>'size'))::bigint, 0) <= 5242880
);

CREATE POLICY "Authenticated users can update their listing images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'listing-images' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (
  bucket_id = 'listing-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE((metadata->>'mimetype'), '')) = ANY (ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'
  ])
  AND COALESCE(((metadata->>'size'))::bigint, 0) <= 5242880
);

-- === 21. ANON CONTACT FOR OWNERLESS LISTING ===
GRANT INSERT ON public.listing_contacts TO anon;

CREATE POLICY "Anon can insert contact for ownerless listing" ON public.listing_contacts FOR INSERT TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_contacts.listing_id AND l.owner_id IS NULL)
);

-- === 22. FIX TABLE GRANTS ===
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_contacts TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.requests TO anon, authenticated;
GRANT SELECT, INSERT ON public.questions TO anon, authenticated;
GRANT DELETE ON public.questions TO authenticated;
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

-- === 23. GRANT HAS_ROLE EXECUTE ===
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- === 24. FIX UPDATE POLICIES ===
GRANT UPDATE ON public.requests TO authenticated;

DROP POLICY IF EXISTS "Owners can update own requests" ON public.requests;
CREATE POLICY "Owners can update own requests" ON public.requests FOR UPDATE USING (auth.uid() = owner_id);

GRANT UPDATE ON public.questions TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can update questions" ON public.questions;
CREATE POLICY "Authenticated users can update questions" ON public.questions FOR UPDATE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_posts TO anon, authenticated;

ALTER TABLE public.regional_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view regional posts" ON public.regional_posts;
CREATE POLICY "Anyone can view regional posts" ON public.regional_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create regional posts" ON public.regional_posts;
CREATE POLICY "Authenticated users can create regional posts" ON public.regional_posts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can update own regional posts" ON public.regional_posts;
CREATE POLICY "Owners can update own regional posts" ON public.regional_posts FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own regional posts" ON public.regional_posts;
CREATE POLICY "Owners can delete own regional posts" ON public.regional_posts FOR DELETE
USING (auth.uid() = owner_id OR EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
));

GRANT SELECT, INSERT, DELETE ON public.regional_replies TO anon, authenticated;

-- === 25. POST APPROVAL STATUS ===
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

UPDATE public.listings       SET status = 'approved' WHERE status = 'pending';
UPDATE public.requests       SET status = 'approved' WHERE status = 'pending';
UPDATE public.questions      SET status = 'approved' WHERE status = 'pending';
UPDATE public.regional_posts SET status = 'approved' WHERE status = 'pending';

GRANT UPDATE ON public.listings       TO authenticated;
GRANT UPDATE ON public.requests       TO authenticated;
GRANT UPDATE ON public.questions      TO authenticated;
GRANT UPDATE ON public.regional_posts TO authenticated;

-- ============================================================
-- EXTRA: TABLES NOT IN MIGRATIONS (created via dashboard)
-- ============================================================

-- Requests table (listings where the poster is looking for something)
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
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '60 days')
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Anon can create requests" ON public.requests FOR INSERT TO anon WITH CHECK (owner_id IS NULL);
CREATE POLICY "Authenticated can create requests" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "Owners can delete own requests" ON public.requests FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Mods can delete any request" ON public.requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX idx_requests_category_created ON public.requests (category, created_at DESC);

-- Regional posts (Australia-wide job/housing/general posts)
CREATE TABLE IF NOT EXISTS public.regional_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  author_name text,
  category text NOT NULL CHECK (category IN ('jobs', 'housing', 'general')),
  region text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  link_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regional_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_regional_posts_created ON public.regional_posts (created_at DESC);

-- Regional replies
CREATE TABLE IF NOT EXISTS public.regional_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.regional_posts(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regional_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view regional replies" ON public.regional_replies FOR SELECT USING (true);
CREATE POLICY "Authenticated can create regional replies" ON public.regional_replies FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_regional_replies_post ON public.regional_replies (post_id, created_at);

-- ============================================================
-- EXTRA: LINK URL COLUMNS (added post-migration)
-- ============================================================
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS link_url text;

-- ============================================================
-- EXTRA: PAGE VIEWS (analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page views" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read page views" ON page_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')));

GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
