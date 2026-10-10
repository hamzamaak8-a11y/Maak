// Run: node --experimental-strip-types tests/retry.test.mjs
import assert from 'node:assert/strict';
import { withRetry } from '../src/lib/retry.ts';

let calls = 0;
assert.equal(await withRetry(async () => { calls++; if (calls === 1) throw new Error('503'); return 'ok'; }, { delayMs: 1 }), 'ok');
assert.equal(calls, 2, 'one failure is retried once');
calls = 0;
await assert.rejects(withRetry(async () => { calls++; throw new Error('still down'); }, { delayMs: 1 }), /still down/);
assert.equal(calls, 2, 'gives up after the retry, so the screen can show an error');
calls = 0;
assert.equal(await withRetry(async () => { calls++; return 1; }, { delayMs: 1 }), 1);
assert.equal(calls, 1, 'a success is not repeated');
console.log('retry: 3 checks passed');
