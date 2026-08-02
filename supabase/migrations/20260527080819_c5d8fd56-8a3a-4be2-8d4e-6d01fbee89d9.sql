
GRANT INSERT ON public.listing_contacts TO anon;

CREATE POLICY "Anon can insert contact for ownerless listing"
  ON public.listing_contacts FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_contacts.listing_id
        AND l.owner_id IS NULL
    )
  );
