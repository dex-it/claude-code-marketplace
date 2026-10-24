import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refundFor } from '../src/billing/refund.js';

const booking = { status: 'paid', start: '2026-09-10T15:00:00Z', priceCents: 140000 };

test('refundFor - отмена за двое суток - полный возврат', () => {
  assert.deepEqual(refundFor(booking, '2026-09-08T15:00:00Z'), { ok: true, amountCents: 140000 });
});

test('refundFor - отмена за 6 часов - половина', () => {
  assert.deepEqual(refundFor(booking, '2026-09-10T09:00:00Z'), { ok: true, amountCents: 70000 });
});

test('refundFor - отмена за час - ноль', () => {
  assert.deepEqual(refundFor(booking, '2026-09-10T14:00:00Z'), { ok: true, amountCents: 0 });
});

test('refundFor - бронь не оплачена - отказ not_paid', () => {
  assert.deepEqual(refundFor({ ...booking, status: 'new' }, '2026-09-08T15:00:00Z'), {
    ok: false,
    code: 'not_paid',
  });
});
