import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, deliver, pack, pay, returnOrder, ship } from '../src/order.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const clock = { now: Date.parse('2026-09-10T09:00:00Z') };
let order, payments, at;
beforeEach(() => {
  const base = clock.now;
  payments = { refunds: [], async refund(id, kopecks) { this.refunds.push({ id, kopecks }); } };
  order = deliveredOrder(base);
  at = (days) => new Date(base + days * DAY_MS + 2 * 60 * 60 * 1000);
});

function deliveredOrder(deliveredAt) {
  const created = createOrder({
    customerId: 'c-1',
    customer: { name: 'Мария Белова', phone: '+79213456703' },
    address: { postcode: '101000', line: 'Москва, Мясницкая ул., 20' },
    items: [{ sku: 'KETTLE-2', qty: 1 }],
    weightKg: 1.2,
  });
  ship(pack(pay(created)), { trackingNumber: 'CS-000001', at: deliveredAt - DAY_MS });
  return deliver(created, { at: deliveredAt });
}

async function tryReturn(days) {
  try {
    await returnOrder(order, { now: at(days), payments });
    return null;
  } catch (error) {
    return error.code;
  }
}

describe('возврат заказа', () => {
  it('возврат после окна отклонён', async () => {
    assert.equal(await tryReturn(15), 'RETURN_FORBIDDEN');
    assert.equal(order.status, 'delivered');
  });

  it('возврат на 14-й день принят', async () => {
    await tryReturn(14);
    assert.equal(order.status, 'returned');
    assert.deepEqual(payments.refunds, [{ id: order.id, kopecks: order.totalKopecks }]);
  });
});
