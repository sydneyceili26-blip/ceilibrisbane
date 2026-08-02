-- Grant execute on has_role to authenticated so RLS policies that call it don't fail.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
