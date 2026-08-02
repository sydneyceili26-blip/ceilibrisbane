-- Grant missing table privileges that were not applied when migrations ran via API.
-- RLS policies alone are not enough; the role must also have table-level privileges.

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
