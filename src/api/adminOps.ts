import { API_URL } from '../config/env';
import { supabase } from '../lib/supabase';

/** Admin operations that need the service-role key run in the Worker; the caller's session token proves who they are. */
async function call<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error('err.config');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_authenticated');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch { throw new Error('err.network'); }
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? 'err.generic');
  return json as T;
}

export type NewUser = {
  email: string; fullName: string; phone?: string; city?: string; role: 'customer' | 'provider'; mode: 'invite' | 'password'; password?: string;
  provider?: { profession: string; category: string; bio: string; services: string[]; experienceYears?: number | null; priceFrom?: number | null; radiusKm?: number | null };
};
export type CreatedUser = { email: string; ok: boolean; id?: string; password?: string; error?: string };

export const createUser = (u: NewUser) => call<CreatedUser>('/admin/users', u);
export const createUsersBulk = async (users: NewUser[]): Promise<CreatedUser[]> => {
  const out: CreatedUser[] = [];
  for (let i = 0; i < users.length; i += 20) out.push(...(await call<{ results: CreatedUser[] }>('/admin/users/bulk', { users: users.slice(i, i + 20) })).results);
  return out;
};
export const recoveryLink = (userId: string, redirectTo?: string) => call<{ link: string }>(`/admin/users/${userId}/recovery`, { redirectTo });
