
-- Roles
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

-- Moderation policies on existing tables
CREATE POLICY "Mods can view reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Mods can delete reports" ON public.reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Mods can delete any listing" ON public.listings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Suburb coordinates lookup
CREATE TABLE public.suburb_coords (
  suburb text PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL
);
ALTER TABLE public.suburb_coords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view suburbs" ON public.suburb_coords FOR SELECT USING (true);

INSERT INTO public.suburb_coords (suburb, lat, lng) VALUES
  ('Sydney CBD', -33.8688, 151.2093),
  ('Surry Hills', -33.8845, 151.2106),
  ('Newtown', -33.8978, 151.1794),
  ('Bondi', -33.8915, 151.2767),
  ('Bondi Beach', -33.8915, 151.2767),
  ('Bondi Junction', -33.8917, 151.2475),
  ('Coogee', -33.9203, 151.2594),
  ('Randwick', -33.9173, 151.2413),
  ('Manly', -33.7969, 151.2855),
  ('Chatswood', -33.7969, 151.1817),
  ('North Sydney', -33.8389, 151.2073),
  ('Parramatta', -33.8150, 151.0011),
  ('Marrickville', -33.9111, 151.1561),
  ('Glebe', -33.8800, 151.1875),
  ('Redfern', -33.8924, 151.2042),
  ('Paddington', -33.8847, 151.2294),
  ('Darlinghurst', -33.8797, 151.2168),
  ('Potts Point', -33.8722, 151.2246),
  ('Pyrmont', -33.8694, 151.1953),
  ('Ultimo', -33.8811, 151.1978),
  ('Alexandria', -33.9111, 151.1972),
  ('Mascot', -33.9239, 151.1875),
  ('Strathfield', -33.8794, 151.0925),
  ('Burwood', -33.8775, 151.1031),
  ('Ashfield', -33.8881, 151.1256),
  ('Leichhardt', -33.8839, 151.1561),
  ('Balmain', -33.8569, 151.1789),
  ('Rozelle', -33.8633, 151.1719),
  ('Mosman', -33.8281, 151.2419),
  ('Cremorne', -33.8278, 151.2275),
  ('Neutral Bay', -33.8331, 151.2192),
  ('Crows Nest', -33.8261, 151.2014),
  ('Lane Cove', -33.8136, 151.1697),
  ('Hornsby', -33.7039, 151.0989),
  ('Ryde', -33.8147, 151.1056),
  ('Epping', -33.7728, 151.0822),
  ('Hurstville', -33.9675, 151.1025),
  ('Kogarah', -33.9619, 151.1339),
  ('Cronulla', -34.0556, 151.1531),
  ('Liverpool', -33.9203, 150.9239),
  ('Bankstown', -33.9181, 151.0344),
  ('Blacktown', -33.7681, 150.9061),
  ('Penrith', -33.7506, 150.6944),
  ('Campbelltown', -34.0667, 150.8167),
  ('Hurlstone Park', -33.9089, 151.1342),
  ('Dulwich Hill', -33.9019, 151.1361),
  ('Camperdown', -33.8889, 151.1769),
  ('Erskineville', -33.9033, 151.1853),
  ('Waterloo', -33.8997, 151.2061),
  ('Zetland', -33.9072, 151.2056);
