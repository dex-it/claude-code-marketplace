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
