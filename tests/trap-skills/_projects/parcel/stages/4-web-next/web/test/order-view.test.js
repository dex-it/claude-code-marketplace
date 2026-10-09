import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancelOrder, loadOrderView } from '../src/order-view.js';

const BASE = 'http://api.test';

function fakeFetch(...responses) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const { status, body } = responses[Math.min(calls.length, responses.length) - 1];
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
        return body;
      },
    };
  };
  return { impl, calls };
}

const shipped = {
  id: 1042,
  status: 'shipped',
  createdAt: '2026-09-27T10:15:00.000Z',
  total: 750,
  courier: { name: 'Сергей Лаптев', phone: '+79110001122' },
  trackingNumber: 'cs-104273',
  items: [{ sku: 'KETTLE-2', qty: 1 }],
};

test('карточка отгруженного заказа', async () => {
  const { impl, calls } = fakeFetch({ status: 200, body: shipped });
  const view = await loadOrderView(impl, BASE, 1042, 'c-301');
  assert.deepEqual(view, {
    title: 'Заказ №1042',
    status: 'Передан в доставку',
    total: '750 ₽',
    courier: 'Сергей Лаптев',
    track: 'CS-104273',
    created: new Date('2026-09-27T10:15:00.000Z').toLocaleDateString('ru-RU'),
  });
  assert.equal(calls[0].url, 'http://api.test/api/orders/1042');
  assert.equal(calls[0].init.headers['x-customer-id'], 'c-301');
});

test('без трек-номера и курьера карточка показывает прочерк', async () => {
  const { impl } = fakeFetch({ status: 200, body: { id: 1040, status: 'created', createdAt: '2026-09-29T08:00:00.000Z', total: 360, items: [] } });
  const view = await loadOrderView(impl, BASE, 1040, 'c-117');
  assert.equal(view.status, 'Создан');
  assert.equal(view.track, '—');
  assert.equal(view.courier, undefined);
});

test('чужой или несуществующий заказ - «Заказ не найден»', async () => {
  const { impl } = fakeFetch({ status: 404, body: { type: 'order-not-found' } });
  assert.deepEqual(await loadOrderView(impl, BASE, 9999, 'c-301'), { error: 'Заказ не найден' });
});

test('ошибка API - «Ошибка сервера»', async () => {
  const { impl } = fakeFetch({ status: 500, body: { type: 'internal' } });
  assert.deepEqual(await loadOrderView(impl, BASE, 1042, 'c-301'), { error: 'Ошибка сервера' });
});

test('отмена: 204 без тела, карточка перечитывается', async () => {
  const { impl, calls } = fakeFetch({ status: 204 }, { status: 200, body: { ...shipped, id: 1041, status: 'cancelled' } });
  const view = await cancelOrder(impl, BASE, 1041, 'c-205');
  assert.equal(view.status, 'Отменён');
  assert.equal(calls[0].url, 'http://api.test/api/orders/1041/cancel');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[1].url, 'http://api.test/api/orders/1041');
});

test('отказ в отмене - «Не удалось отменить»', async () => {
  const { impl } = fakeFetch({ status: 409, body: { type: 'cancel-forbidden' } });
  assert.deepEqual(await cancelOrder(impl, BASE, 1042, 'c-301'), { error: 'Не удалось отменить' });
});
