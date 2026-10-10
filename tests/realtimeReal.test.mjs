// Uses the real supabase-js Realtime client (no network needed to reproduce): proves the old pattern throws and the hub does not.
// Run: node --experimental-strip-types tests/realtimeReal.test.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createRealtimeHub } from '../src/lib/realtimeHub.ts';

const sb = createClient('http://127.0.0.1:9', 'anon-key', { realtime: { transport: class { constructor() { this.readyState = 0; } send() {} close() {} } } });
const filter = { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.1' };
const oldPattern = () => sb.channel('user:1:notifications').on('postgres_changes', filter, () => {}).subscribe();

oldPattern();
assert.throws(oldPattern, /cannot add `postgres_changes` callbacks/); // the reported crash: second subscriber (bell + notifications screen)
await sb.removeChannel(sb.getChannels()[0]);

const subscribe = createRealtimeHub(sb);
const off1 = subscribe('user:1:notifications', filter, () => {});
const off2 = subscribe('user:1:notifications', filter, () => {});   // no throw
assert.equal(sb.getChannels().length, 1);
off1(); off2();
assert.equal(sb.getChannels().length, 0);
for (let i = 0; i < 5; i++) subscribe('user:1:notifications', filter, () => {})();   // repeated navigation
assert.equal(sb.getChannels().length, 0);
console.log('realtime (real supabase-js): old pattern throws, hub is safe');
process.exit(0);
