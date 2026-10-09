-- Revoking a push token must work even when the person is no longer signed in (offline sign-out, expired session).
-- The token itself is the proof: it is a long random value that only the phone that registered it knows, and the only thing this
-- function can do is make the server STOP sending to that token. It cannot list tokens, read anything, or add one.

create or replace function public.revoke_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then return; end if;
  delete from public.push_tokens where token = btrim(p_token);
end;
$$;

revoke all on function public.revoke_push_token(text) from public, anon, authenticated;
grant execute on function public.revoke_push_token(text) to anon, authenticated;
