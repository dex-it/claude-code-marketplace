import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cancel, createOrder, pack, pay, ship, OrderStateError } from '../src/order.js';

function newOrder() {
  return createOrder({
    customerId: 'c-1',
    customer: { name: 'Мария Белова', phone: '+79213456703' },
    address: { postcode: '101000', line: 'Москва, Мясницкая ул., 20' },
    items: [{ sku: 'KETTLE-2', qty: 1 }],
    weightKg: 1.2,
  });
}

function deps() {
  const refunds = [];
  const released = [];
  return {
    refunds,
    released,
    payments: { refund: (orderId, kopecks) => refunds.push({ orderId, kopecks }) },
    stock: { release: (items) => released.push(...items) },
  };
}

describe('отмена заказа (PAR-12)', () => {
  it('из paid возвращает сумму заказа', () => {
    const d = deps();
    const order = pay(newOrder());
    cancel(order, d);
    assert.equal(order.status, 'cancelled');
    assert.deepEqual(d.refunds, [{ orderId: order.id, kopecks: 36000 }]);
  });

  it('из created снимает резерв без возврата денег', () => {
    const d = deps();
    const order = newOrder();
    cancel(order, d);
    assert.deepEqual(d.released, [{ sku: 'KETTLE-2', qty: 1 }]);
    assert.deepEqual(d.refunds, []);
  });

  it('из shipped запрещена', () => {
    const d = deps();
    const order = ship(pack(pay(newOrder())), { trackingNumber: 'CS-000001' });
    assert.throws(() => cancel(order, d), (error) => error instanceof OrderStateError && error.code === 'CANCEL_FORBIDDEN');
    assert.equal(order.status, 'shipped');
    assert.deepEqual(d.refunds, []);
  });
});
