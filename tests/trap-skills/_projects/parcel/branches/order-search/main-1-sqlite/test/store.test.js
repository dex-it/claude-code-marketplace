import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

test('заказ находится по номеру строкой и числом', () => {
  const store = createStore([{ id: 1042, status: 'shipped' }]);
  assert.equal(store.get(1042).status, 'shipped');
  assert.equal(store.get('1042').status, 'shipped');
  assert.equal(store.get(1043), undefined);
});

test('put заменяет заказ с тем же номером', () => {
  const store = createStore();
  store.put({ id: 7, status: 'created' });
  store.put({ id: 7, status: 'paid' });
  assert.deepEqual(store.all(), [{ id: 7, status: 'paid' }]);
});

test('заказы клиента - только его, новые сверху', () => {
  const store = createStore([
    { id: 1, customerId: 'c-1', createdAt: '2026-09-20T10:00:00.000Z' },
    { id: 2, customerId: 'c-2', createdAt: '2026-09-21T10:00:00.000Z' },
    { id: 3, customerId: 'c-1', createdAt: '2026-09-22T10:00:00.000Z' },
  ]);
  assert.deepEqual(store.byCustomer('c-1').map((o) => o.id), [3, 1]);
  assert.deepEqual(store.byCustomer('c-9'), []);
});
