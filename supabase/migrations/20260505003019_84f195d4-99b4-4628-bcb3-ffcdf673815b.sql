ALTER TYPE public.listing_category ADD VALUE IF NOT EXISTS 'car';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS item_type text;
CREATE INDEX IF NOT EXISTS listings_item_type_idx ON public.listings (item_type) WHERE item_type IS NOT NULL;