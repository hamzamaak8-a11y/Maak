// Run: node --experimental-strip-types tests/bookingRules.test.mjs
// The same case matrix is executed against the real SQL functions in supabase/ci/booking-money-rules-test.sql.
import assert from 'node:assert/strict';
import { canAdminMarkPaid, canAdminRefund, canProviderSetPrice, isPriceLocked } from '../src/lib/bookingRules.ts';

const b = (status, price, payment_status) => ({ status, price, payment_status });
const price = [
  [b('pending', null, 'unpaid'), true], [b('pending', 50, 'pending'), true],
  [b('accepted', null, 'unpaid'), true], [b('accepted', 100, 'pending'), true],
  [b('in_progress', null, 'unpaid'), true], [b('in_progress', 80, 'pending'), false],
  [b('completed', null, 'unpaid'), true], [b('completed', 80, 'pending'), false],
  [b('cancelled', 50, 'pending'), false], [b('rejected', null, 'unpaid'), false],
  [b('completed', 80, 'paid'), false], [b('completed', 80, 'refunded'), false], [b('pending', 50, 'paid'), false],
];
for (const [bk, want] of price) assert.equal(canProviderSetPrice(bk), want, `set price ${JSON.stringify(bk)}`);
assert.equal(isPriceLocked(b('in_progress', 80, 'pending')), true);
assert.equal(isPriceLocked(b('accepted', 100, 'pending')), false);
assert.equal(isPriceLocked(b('completed', 80, 'paid')), true);
assert.equal(isPriceLocked(b('cancelled', 50, 'pending')), false);

const paid = [
  [b('completed', 120, 'pending'), true], [b('completed', 120, 'unpaid'), true], [b('completed', null, 'unpaid'), false],
  [b('completed', 80, 'paid'), false], [b('completed', 80, 'refunded'), false],
  [b('cancelled', 50, 'pending'), false], [b('rejected', 50, 'pending'), false], [b('pending', 70, 'pending'), false],
  [b('accepted', 100, 'pending'), false], [b('in_progress', 80, 'pending'), false],
];
for (const [bk, want] of paid) assert.equal(canAdminMarkPaid(bk), want, `mark paid ${JSON.stringify(bk)}`);
assert.equal(canAdminRefund(b('completed', 80, 'paid')), true);
for (const s of ['unpaid', 'pending', 'refunded']) assert.equal(canAdminRefund(b('completed', 80, s)), false);
console.log('bookingRules: ' + (price.length + paid.length + 8) + ' checks passed');
