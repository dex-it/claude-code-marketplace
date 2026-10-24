import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createArchive } from '../src/archive.js';
import { createServer } from '../src/http/server.js';
import { createStore } from '../src/store.js';

const base = {
  customer: { name: 'Мария Белова', phone: '+79213456703' },
  address: { postcode: '101000', line: 'Москва, Мясницкая ул., 20' },
  items: [{ sku: 'KETTLE-2', qty: 1 }],
  weightKg: 1.2,
  zone: 'A',
  express: false,
  fragile: false,
  history: [],
};

function sampleOrders() {
  return [
    {
      ...base,
      id: 2001,
      customerId: 'c-1',
      status: 'shipped',
      totalKopecks: 36000,
      createdAt: '2026-09-27T10:15:00.000Z',
      trackingNumber: 'CS-200101',
      courierName: 'Сергей Лаптев',
      courierPhone: '+79110001122',
    },
    { ...base, id: 2002, customerId: 'c-1', status: 'paid', totalKopecks: 36000, createdAt: '2026-09-29T08:00:00.000Z', giftMessage: 'Поздравляю!' },
    { ...base, id: 2003, customerId: 'c-2', status: 'created', totalKopecks: 24000, createdAt: '2026-09-29T09:00:00.000Z' },
    {
      ...base,
      id: 2004,
      customerId: 'c-2',
      status: 'delivered',
      totalKopecks: 24000,
      createdAt: '2026-09-20T09:00:00.000Z',
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

const archived = [{ ...base, id: 871, customerId: 'c-1', status: 'delivered', totalKopecks: 48000, createdAt: '2025-06-14T10:20:00.000Z' }];

describe('API заказов 2.4.0', () => {
  let server, url, store, refunds, released;

  before(async () => {
    server = createServer({
      store: { get: (id) => store.get(id), put: (order) => store.put(order), all: () => store.all() },
      archive: createArchive(archived),
      payments: { refund: (id, kopecks) => refunds.push({ id, kopecks }) },
      stock: { release: (items) => released.push(...items) },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    store = createStore(sampleOrders());
    refunds = [];
    released = [];
  });

  const get = (id, customerId = 'c-1') => fetch(`${url}/api/orders/${id}`, { headers: { 'x-customer-id': customerId } });
  const post = (path, customerId) => fetch(`${url}${path}`, { method: 'POST', headers: { 'x-customer-id': customerId } });

  it('отгруженный заказ: курьер объектом, сумма в копейках, дата - мс', async () => {
    const res = await get(2001);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      id: 2001,
      status: 'shipped',
      createdAt: Date.parse('2026-09-27T10:15:00.000Z'),
      total: 36000,
      courier: { name: 'Сергей Лаптев', phone: '+79110001122' },
      trackingNumber: 'CS-200101',
      items: [{ sku: 'KETTLE-2', qty: 1 }],
    });
  });

  it('неотгруженный заказ: трек и курьер - null, поздравление передаётся', async () => {
    const body = await (await get(2002)).json();
    assert.equal(body.trackingNumber, null);
    assert.equal(body.courier, null);
    assert.equal(body.giftMessage, 'Поздравляю!');
  });

  it('нет заказа - 404 order-not-found', async () => {
    const res = await get(2999);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { type: 'order-not-found' });
  });

  it('архивный заказ отдаётся из архива', async () => {
    const res = await get(871);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).total, 48000);
  });

  it('нет архивного заказа - 404 not_found', async () => {
    const res = await get(872);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { type: 'not_found' });
  });

  it('отмена оплаченного заказа - 204, деньги возвращены, резерв снят', async () => {
    const res = await post('/api/orders/2002/cancel', 'c-1');
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
    assert.equal(store.get(2002).status, 'cancelled');
    assert.deepEqual(refunds, [{ id: 2002, kopecks: 36000 }]);
    assert.deepEqual(released, [{ sku: 'KETTLE-2', qty: 1 }]);
  });

  it('отмена чужого заказа - 404', async () => {
    const res = await post('/api/orders/2003/cancel', 'c-1');
    assert.equal(res.status, 404);
    assert.equal(store.get(2003).status, 'created');
  });

  it('отмена доставленного - 409', async () => {
    const res = await post('/api/orders/2004/cancel', 'c-2');
    assert.equal(res.status, 409);
    assert.equal((await res.json()).type, 'cancel-forbidden');
  });

  it('возврат доставленного заказа - 204, статус returned', async () => {
    const res = await post('/api/orders/2004/return', 'c-2');
    assert.equal(res.status, 204);
    assert.equal(store.get(2004).status, 'returned');
    assert.deepEqual(refunds, [{ id: 2004, kopecks: 24000 }]);
    assert.equal((await (await get(2004, 'c-2')).json()).status, 'returned');
  });
});
