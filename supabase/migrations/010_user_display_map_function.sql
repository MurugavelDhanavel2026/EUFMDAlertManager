-- Helper function that returns (id, username, display_name) for any set
-- of user_profile IDs, bypassing user_profiles RLS. Used by the alert
-- history timeline so AlertHandlers can see WHO performed each action
-- (incl. admins / supervisors that are otherwise hidden by RLS).
--
-- Safe to expose because only non-sensitive display fields are returned —
-- emails, roles, and timestamps stay protected by the existing RLS on
-- user_profiles.
CREATE OR REPLACE FUNCTION public.get_user_display_map(p_user_ids UUID[])
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT up.id, up.username, up.display_name
  FROM public.user_profiles up
  WHERE up.id = ANY(p_user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_user_display_map(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_display_map(UUID[]) TO authenticated;
