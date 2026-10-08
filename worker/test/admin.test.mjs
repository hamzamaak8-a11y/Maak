// Run: node --experimental-strip-types --import ./worker/test/register.mjs worker/test/admin.test.mjs
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', MAAK_ALLOW_ORIGIN: 'https://app.example' };
const ctx = { waitUntil() {} };
const calls = [];
let adminProfile = { role: 'admin', account_status: 'active' };
const ok = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = String(input); const method = init.method ?? 'GET'; const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ url, method, body });
  if (url.endsWith('/auth/v1/user')) return /Bearer good/.test(init.headers?.Authorization ?? '') ? ok({ id: 'admin-1' }) : ok({ msg: 'bad' }, 401);
  if (url.includes('/rest/v1/profiles?id=eq.admin-1')) return ok([adminProfile]);
  if (url.endsWith('/auth/v1/admin/users')) return ok({ id: 'new-1' });
  if (url.includes('/rest/v1/profiles?id=eq.new-1&select=id')) return ok([{ id: 'new-1' }]);
  return ok({}, 201);
};

const post = (path, body, token) => worker.fetch(new Request('https://w.test' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }), env, ctx);
const provider = { email: 'Pro@X.com', fullName: 'Pro Man', role: 'provider', mode: 'password', provider: { profession: 'Plumber', category: 'سباكة', bio: 'Experienced', services: ['Leaks'] } };

// health tells the owner which Worker version is live
{ const r = await worker.fetch(new Request('https://w.test/health'), env, ctx); const j = await r.json(); assert.equal(r.status, 200); assert.ok(j.features.includes('admin')); }
// authorization matrix: 401 without / with a bad token, 403 for a non-admin, 200 for an active admin
assert.equal((await post('/admin/users', provider)).status, 401);
assert.equal((await post('/admin/users', provider, 'bad')).status, 401);
adminProfile = { role: 'customer', account_status: 'active' };
assert.equal((await post('/admin/users', provider, 'good')).status, 403);
adminProfile = { role: 'admin', account_status: 'suspended' };
assert.equal((await post('/admin/users', provider, 'good')).status, 403);
adminProfile = { role: 'admin', account_status: 'active' };
calls.length = 0;
const created = await post('/admin/users', provider, 'good');
assert.equal(created.status, 200);
const cj = await created.json();
assert.equal(cj.ok, true); assert.equal(cj.status, 'draft');
// a provider created by an admin is NEVER approved and never gets the provider role before document review
const pp = calls.find(c => c.url.includes('/rest/v1/provider_profiles'));
assert.equal(pp.body.verification_status, 'draft');
const patch = calls.find(c => c.method === 'PATCH' && c.url.includes('/rest/v1/profiles'));
assert.equal('role' in patch.body, false);
assert.ok(!calls.some(c => JSON.stringify(c.body ?? '').includes('"approved"')));
// bulk import follows the same rules
calls.length = 0;
const bulk = await post('/admin/users/bulk', { users: [provider, { ...provider, email: 'two@x.com' }] }, 'good');
assert.equal(bulk.status, 200);
assert.ok(calls.filter(c => c.url.includes('/rest/v1/provider_profiles')).every(c => c.body.verification_status === 'draft'));
assert.equal((await post('/admin/users/bulk', { users: [] }, 'good')).status, 400);
// an unknown admin route is a 404 only AFTER authentication
assert.equal((await post('/admin/nope', {})).status, 401);
assert.equal((await post('/admin/nope', {}, 'good')).status, 404);
console.log('worker admin: all tests passed');
