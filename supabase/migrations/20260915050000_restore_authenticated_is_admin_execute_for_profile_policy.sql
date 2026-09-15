-- Runtime fix: profiles_select_admin evaluates public.is_admin() for authenticated users.
-- The function is SECURITY DEFINER and only returns whether the current caller is an active admin.
-- Keep anonymous execution denied while restoring the privilege required by the authenticated RLS policy.

grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_admin() from anon;
