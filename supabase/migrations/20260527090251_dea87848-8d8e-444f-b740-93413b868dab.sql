-- 1. Revoke RPC access to has_role to prevent admin enumeration
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;

-- 2. Restrict listing_contacts SELECT to owner or conversation participant
DROP POLICY IF EXISTS "Authenticated can view contacts" ON public.listing_contacts;

CREATE POLICY "Owner or participant can view contact"
  ON public.listing_contacts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_contacts.listing_id
        AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.listing_id = listing_contacts.listing_id
        AND (c.starter_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );