import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBooking } from '../src/api/bookings.js';

const deps = {
  payflow: { hold: async () => ({ id: 'h1' }) },
  db: { insertBooking: async (b) => ({ id: 'b1', ...b }) },
};

test('createBooking - холд прошёл - 201 и бронь', async () => {
  const res = await createBooking({ body: { slot: 's1', studentId: 'u1', priceCents: 140000 } }, deps);
  assert.equal(res.status, 201);
  assert.equal(res.body.holdId, 'h1');
});
