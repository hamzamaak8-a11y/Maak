revoke execute on function public.submit_review(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

revoke execute on function public.get_provider_reviews(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_provider_reviews(uuid, integer, integer) to anon, authenticated;

revoke execute on function public.admin_toggle_review_visibility(uuid) from public, anon, authenticated;
grant execute on function public.admin_toggle_review_visibility(uuid) to authenticated;

revoke execute on function public.get_admin_reviews(integer, integer) from public, anon, authenticated;
grant execute on function public.get_admin_reviews(integer, integer) to authenticated;
