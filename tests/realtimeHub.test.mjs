// Run: node --experimental-strip-types tests/realtimeHub.test.mjs
import assert from 'node:assert/strict';
import { createRealtimeHub } from '../src/lib/realtimeHub.ts';

// Fake client that behaves like supabase-js: same topic returns the existing channel,
// and adding a postgres_changes callback after subscribe() throws.
function fakeClient() {
  const channels = new Map();
  const removed = [];
  return {
    removed,
    channels,
    channel(topic) {
      if (channels.has(topic)) return channels.get(topic);
      const ch = { topic, subscribed: false, cbs: [],
        on(_t, _f, cb) { if (this.subscribed) throw new Error('cannot add `postgres_changes` callbacks for ' + topic + ' after `subscribe()`.'); this.cbs.push(cb); return this; },
        subscribe() { this.subscribed = true; return this; } };
      channels.set(topic, ch);
      return ch;
    },
    removeChannel(ch) { removed.push(ch.topic); channels.delete(ch.topic); },
  };
}
const emit = (client, row) => { for (const ch of client.channels.values()) for (const cb of ch.cbs) cb({ new: row }); };

// 1. Bell + notifications screen subscribe to the same stream: no throw, one channel, both receive.
{
  const c = fakeClient(); const sub = createRealtimeHub(c); const a = [], b = [];
  const offA = sub('user:1:notifications', {}, r => a.push(r));
  const offB = sub('user:1:notifications', {}, r => b.push(r));
  assert.equal(c.channels.size, 1);
  emit(c, { id: 'n1' });
  assert.deepEqual(a, [{ id: 'n1' }]); assert.deepEqual(b, [{ id: 'n1' }]);
  offA(); assert.equal(c.channels.size, 1); emit(c, { id: 'n2' }); assert.equal(a.length, 1); assert.equal(b.length, 2);
  offB(); assert.equal(c.channels.size, 0); assert.equal(c.removed.length, 1);
}
// 2. Repeated navigation (mount, unmount, mount) never reuses a subscribed channel.
{
  const c = fakeClient(); const sub = createRealtimeHub(c);
  for (let i = 0; i < 5; i++) { const off = sub('user:1:notifications', {}, () => {}); off(); off(); }
  assert.equal(c.channels.size, 0);
  const off = sub('user:1:notifications', {}, () => {}); assert.equal(c.channels.size, 1); off();
}
// 3. Account switch: another user gets its own channel; the previous one is released.
{
  const c = fakeClient(); const sub = createRealtimeHub(c); const seen = [];
  const off1 = sub('user:1:notifications', {}, r => seen.push(['u1', r.id]));
  off1();
  const off2 = sub('user:2:notifications', {}, r => seen.push(['u2', r.id]));
  emit(c, { id: 'x' });
  assert.deepEqual(seen, [['u2', 'x']]); off2();
}
console.log('realtimeHub: 3 tests passed');
