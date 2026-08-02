
-- 1. New table for sensitive contact details
CREATE TABLE public.listing_contacts (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  contact_email text,
  contact_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Move existing data
INSERT INTO public.listing_contacts (listing_id, contact_email, contact_phone)
SELECT id, contact_email, contact_phone
FROM public.listings
WHERE contact_email IS NOT NULL OR contact_phone IS NOT NULL;

-- 3. Drop the now-redundant public columns
ALTER TABLE public.listings DROP COLUMN contact_email;
ALTER TABLE public.listings DROP COLUMN contact_phone;

-- 4. Grants - auth-only table, no anon access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_contacts TO authenticated;
GRANT ALL ON public.listing_contacts TO service_role;

-- 5. RLS
ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contacts"
  ON public.listing_contacts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner can insert contact"
  ON public.listing_contacts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_contacts.listing_id
        AND l.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update contact"
  ON public.listing_contacts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_contacts.listing_id
        AND l.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner or mod can delete contact"
  ON public.listing_contacts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_contacts.listing_id
        AND l.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

-- 6. Fix owner_id spoofing on listings INSERT
DROP POLICY IF EXISTS "Anyone can create listings" ON public.listings;

CREATE POLICY "Anon can create listings"
  ON public.listings FOR INSERT TO anon
  WITH CHECK (owner_id IS NULL);

CREATE POLICY "Authenticated can create listings"
  ON public.listings FOR INSERT TO authenticated
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());
