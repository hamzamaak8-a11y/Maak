// Run: node --experimental-strip-types --import ./worker/test/register.mjs worker/test/providers.test.mjs
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', MAAK_ALLOW_ORIGIN: '' };
const P = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const listing = (id, n, extra = {}) => ({ id, name: 'P' + id, job: 'Job', city: 'C', distance: null, price: '120.00', rating: null, reviews: 0, image: null, available: null, services: ['x'], experience: null, intro: null, provider_profile_id: P(n), listing_kind: 'real', published_at: '2026-01-01', ...extra });
const listings = [listing(1, 1), listing(2, 2), listing(3, 3), listing(4, 4), listing(5, 5, { available: false }), listing(6, 6)];
const status = { 1: 'approved', 2: 'pending', 3: 'approved', 4: 'approved', 5: 'approved', 6: 'rejected' };
const account = { 1: 'active', 2: 'active', 3: 'suspended', 4: 'active', 5: 'active', 6: 'active' };
const windows = [1, 3, 5, 6]; // listing ids that have working hours (4 has none)

globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
globalThis.fetch = async (input) => {
  const url = String(input);
  const ok = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/rest/v1/providers')) { const m = url.match(/[?&]id=eq\.(\d+)/); return ok(m ? listings.filter((l) => l.id === Number(m[1])) : listings); }
  if (url.includes('/rest/v1/provider_profiles')) return ok([1, 2, 3, 4, 5, 6].map((n) => ({ id: P(n), service_category: 'cat', verification_status: status[n] })));
  if (url.includes('/rest/v1/profiles')) return ok([1, 2, 3, 4, 5, 6].map((n) => ({ id: P(n), account_status: account[n] })));
  if (url.includes('/rest/v1/reviews')) return ok([{ provider_id: P(1), rating: 5 }, { provider_id: P(1), rating: 4 }]);
  if (url.includes('/rest/v1/provider_services')) return ok([{ provider_id: P(1), currency: 'EUR' }, { provider_id: P(1), currency: 'EUR' }, { provider_id: P(4), currency: 'MAD' }, { provider_id: P(4), currency: 'USD' }]);
  if (url.includes('/rest/v1/provider_availability')) return ok(windows.map((id) => ({ provider_id: id })));
  throw new Error('unexpected ' + url);
};
const get = (path) => worker.fetch(new Request('https://w.test' + path), env, { waitUntil() {} });

const list = await (await get('/api/providers')).json();
// only APPROVED providers with an ACTIVE account are public: pending (2), suspended account (3) and rejected (6) are not returned
assert.deepEqual(list.map((p) => p.id), [1, 4, 5]);
assert.ok(list.every((p) => p.verified === true));
const byId = Object.fromEntries(list.map((p) => [p.id, p]));
assert.equal(byId[1].currency, 'EUR');            // single currency in the price list
assert.equal(byId[4].currency, null);             // mixed currencies: unknown, never guessed
assert.equal(byId[1].rating, '4.5'); assert.equal(byId[1].reviews, 2);
assert.equal(byId[1].available, true);            // approved + working hours
assert.equal(byId[4].available, false);           // approved but no working hours yet
assert.equal(byId[5].available, false);           // paused by the provider even though it has hours
// direct lookups follow the same rule
assert.equal((await get('/api/providers/2')).status, 404);
assert.equal((await get('/api/providers/3')).status, 404);
assert.equal((await get('/api/providers/6')).status, 404);
assert.equal((await get('/api/providers/1')).status, 200);
console.log('worker providers: approval, currency and availability rules passed');
