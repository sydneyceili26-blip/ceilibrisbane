
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
