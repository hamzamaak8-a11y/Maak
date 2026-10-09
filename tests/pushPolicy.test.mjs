// Run: node --experimental-strip-types tests/pushPolicy.test.mjs
// Consent and revocation rules (src/lib/pushPolicy.ts) with a fake phone, fake storage and a fake server.
import assert from 'node:assert/strict';
import { createPush } from '../src/lib/pushPolicy.ts';

function phone({ permission = 'granted', canAskAgain = true } = {}) {
  const store = new Map();
  const server = new Map(); // token -> user id (what public.push_tokens holds)
  const net = { online: true, sessionValid: true };
  let current = null; // account signed in on the phone (the server learns it from the session)
  const os = { perm: { status: permission, canAskAgain }, dialogs: 0, token: 'ExponentPushToken[device-abc-0001]' };
  const need = () => { if (!net.online) throw new Error('Network request failed'); };
  const deps = {
    signOutTimeoutMs: 50,
    storage: { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, remove: async k => { store.delete(k); } },
    os: {
      available: () => true,
      permission: async () => ({ ...os.perm }),
      request: async () => { if (os.perm.canAskAgain === false) return { ...os.perm }; os.dialogs++; os.perm = { status: 'granted', canAskAgain: true }; return { ...os.perm }; },
      token: async () => (os.perm.status === 'granted' ? os.token : null),
    },
    api: {
      register: async (token) => { need(); if (!net.sessionValid) throw new Error('jwt expired'); server.set(token, current); },
      unregister: async (token) => { need(); if (!net.sessionValid) throw new Error('jwt expired'); if (server.get(token) === current) server.delete(token); },
      revoke: async (token) => { need(); server.delete(token); },
    },
  };
  return { push: createPush(deps), store, server, net, os, signIn: uid => { current = uid; } };
}
const A = 'user-a', B = 'user-b';

// 1. system permission alone is not consent
{ const p = phone(); p.signIn(A);
  assert.equal(await p.push.state(A), 'off', 'granted by the OS but never turned on in Maak');
  await p.push.refresh(A, 'ar'); assert.equal(p.server.size, 0, 'refresh must not register a phone that never opted in'); }

// 2. enable -> disable -> language change / app restart / account change: stays OFF
{ const p = phone(); p.signIn(A);
  assert.equal(await p.push.enable(A, 'en'), 'on'); assert.equal(p.server.get(p.os.token), A);
  const r = await p.push.disable(A); assert.equal(r.revoked, true);
  assert.equal(p.server.size, 0); assert.equal(await p.push.state(A), 'off');
  await p.push.refresh(A, 'fr'); await p.push.refresh(A, 'ar');   // the language changed: what PushManager does
  assert.equal(p.server.size, 0, 'a language change must not switch notifications back on');
  p.signIn(B); await p.push.refresh(B, 'fr');
  assert.equal(p.server.size, 0, 'another account on the same phone is also OFF until it agrees');
  assert.equal(await p.push.state(B), 'off');
  assert.equal(p.os.dialogs, 0, 'the system dialog was not needed again');
  p.signIn(A);
  assert.equal(await p.push.enable(A, 'en'), 'on'); assert.equal(p.server.get(p.os.token), A, 'agreeing again turns it on'); }

// 3. OFF stays OFF even when the server could not be told (offline): intent is saved first, revocation is queued
{ const p = phone(); p.signIn(A); await p.push.enable(A, 'en');
  p.net.online = false;
  const r = await p.push.disable(A);
  assert.equal(r.revoked, false); assert.equal(await p.push.state(A), 'off');
  assert.deepEqual(await p.push.pending(), [p.os.token]);
  await p.push.refresh(A, 'ar'); assert.equal(p.server.get(p.os.token), A, 'server still has it (offline) but the phone never re-registers');
  assert.equal(await p.push.flushPending(), 1, 'still offline: stays queued');
  p.net.online = true;
  assert.equal(await p.push.flushPending(), 0); assert.equal(p.server.size, 0, 'revoked once the phone is back online');
  assert.deepEqual(await p.push.pending(), []); }

// 4. sign-out offline: bounded, never throws, queued, then revoked WITHOUT a session
{ const p = phone(); p.signIn(A); await p.push.enable(A, 'en');
  p.net.online = false; p.net.sessionValid = false;
  const t0 = Date.now(); const r = await p.push.disableForSignOut(A);
  assert.equal(r.revoked, false); assert.ok(Date.now() - t0 < 1000, 'signing out is not held up by the network');
  p.signIn(null); p.net.online = true; // guest now, back online, session gone
  assert.equal(await p.push.flushPending(), 0); assert.equal(p.server.size, 0, 'the old account no longer reaches this phone'); }

// 5. expired session but online: falls back to the session-less revoke immediately
{ const p = phone(); p.signIn(A); await p.push.enable(A, 'en'); p.net.sessionValid = false;
  const r = await p.push.disableForSignOut(A); assert.equal(r.revoked, true); assert.equal(p.server.size, 0); }

// 6. hung network on sign-out: bounded by the timeout
{ const p = phone(); p.signIn(A); await p.push.enable(A, 'en');
  const real = p.server.delete.bind(p.server);
  const deps = { signOutTimeoutMs: 40, storage: { get: async k => p.store.get(k) ?? null, set: async (k, v) => { p.store.set(k, v); }, remove: async k => { p.store.delete(k); } },
    os: { available: () => true, permission: async () => ({ status: 'granted', canAskAgain: true }), request: async () => ({ status: 'granted', canAskAgain: true }), token: async () => p.os.token },
    api: { register: async () => {}, unregister: () => new Promise(() => {}), revoke: () => new Promise(() => {}) } };
  const hung = createPush(deps);
  const t0 = Date.now(); const r = await hung.disableForSignOut(A);
  assert.equal(r.revoked, false); assert.ok(Date.now() - t0 < 500); assert.deepEqual(await hung.pending(), [p.os.token]); void real; }

// 7. shared phone: A signs out offline, B signs in and registers the same token; A's queued revoke must NOT undo B
{ const p = phone(); p.signIn(A); await p.push.enable(A, 'en');
  p.net.online = false; await p.push.disableForSignOut(A);
  p.signIn(B); p.net.online = true;
  assert.equal(await p.push.enable(B, 'fr'), 'on'); assert.equal(p.server.get(p.os.token), B);
  assert.deepEqual(await p.push.pending(), [], 'registering on purpose clears the older revoke for that token');
  assert.equal(await p.push.flushPending(), 0); assert.equal(p.server.get(p.os.token), B, "B's registration survives"); }

// 8. the system permission is revoked in Android settings: state follows, refresh does nothing
{ const p = phone(); p.signIn(A); await p.push.enable(A, 'en');
  p.os.perm = { status: 'denied', canAskAgain: false };
  assert.equal(await p.push.state(A), 'denied'); await p.push.refresh(A, 'ar'); }

// 9. enabling asks the system exactly once, and a denial is reported without registering
{ const p = phone({ permission: 'undetermined' }); p.signIn(A);
  assert.equal(await p.push.state(A), 'off'); assert.equal(await p.push.enable(A, 'en'), 'on'); assert.equal(p.os.dialogs, 1); }
{ const deny = phone({ permission: 'denied', canAskAgain: false }); deny.signIn(A);
  assert.equal(await deny.push.enable(A, 'en'), 'denied'); assert.equal(deny.server.size, 0); }
console.log('pushPolicy: consent, offline revoke, shared phone and sign-out cases passed');
