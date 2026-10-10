// Run: node --experimental-strip-types --import ./worker/test/register.mjs worker/test/push.test.mjs
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

const SECRET = 'a-very-long-shared-secret-123456';
const env = (extra = {}) => ({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', MAAK_ALLOW_ORIGIN: '', ...extra });
const USER = '00000000-0000-0000-0000-0000000000c1';
const calls = [];
let tickets = [];
globalThis.fetch = async (input, init = {}) => {
  const url = String(input); calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
  const ok = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/rest/v1/push_tokens') && (init.method ?? 'GET') === 'GET') return ok([{ token: 'ExponentPushToken[tokenEnglish0001]', lang: 'en' }, { token: 'ExponentPushToken[tokenArabic00002]', lang: 'ar' }]);
  if (url.startsWith('https://exp.host/')) return ok({ data: tickets });
  return ok({});
};
const post = (e, body, secret = SECRET) => worker.fetch(new Request('https://w.test/push/notify', { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'X-Maak-Push-Secret': secret } : {}) }, body: JSON.stringify(body) }), e, { waitUntil() {} });
const note = { user_id: USER, type: 'booking_new', title: 'notifications.bookingNewTitle', body: 'notifications.bookingNewBody', metadata: { booking_id: 'b1' } };

// feature is off without a configured secret (and does not reveal itself)
assert.equal((await post(env(), note)).status, 404);
assert.equal((await post(env({ PUSH_WEBHOOK_SECRET: 'short' }), note)).status, 404);
const on = env({ PUSH_WEBHOOK_SECRET: SECRET });
assert.equal((await post(on, note, '')).status, 401);
assert.equal((await post(on, note, 'wrong-secret-wrong-secret-12345')).status, 401);
assert.equal((await post(on, { ...note, user_id: 'not-a-uuid' })).status, 400);
assert.equal((await post(on, { ...note, title: 5 })).status, 400);
assert.equal(calls.filter((c) => c.url.startsWith('https://exp.host/')).length, 0, 'nothing may be sent for rejected calls');

// valid call: one message per device, localized per device language, data carries the booking id
tickets = [{ status: 'ok' }, { status: 'ok' }];
calls.length = 0;
const res = await post(on, note);
assert.equal(res.status, 200); assert.deepEqual(await res.json(), { sent: 2 });
const expo = calls.find((c) => c.url.startsWith('https://exp.host/')).body;
assert.equal(expo.length, 2);
assert.equal(expo[0].title, 'New booking request'); assert.equal(expo[1].title, 'طلب حجز جديد');
assert.deepEqual(expo[0].data, { booking_id: 'b1' });
assert.ok(calls.find((c) => c.url.includes('push_tokens?user_id=eq.' + USER)), 'tokens are looked up for this user only');

// announcements are free text: sent as written
calls.length = 0; tickets = [{ status: 'ok' }, { status: 'ok' }];
await post(on, { ...note, type: 'announcement', title: 'Maintenance tonight.', body: 'Short downtime at 22:00. Thanks.' });
const free = calls.find((c) => c.url.startsWith('https://exp.host/')).body;
assert.equal(free[0].title, 'Maintenance tonight.'); assert.equal(free[1].body, 'Short downtime at 22:00. Thanks.');

// a token Expo reports as gone is deleted
calls.length = 0; tickets = [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }];
const r2 = await post(on, note);
assert.deepEqual(await r2.json(), { sent: 1 });
const del = calls.find((c) => c.method === 'DELETE');
assert.ok(del && del.url.includes(encodeURIComponent('ExponentPushToken[tokenArabic00002]')));
console.log('worker push: secret, validation, localization and cleanup passed');
