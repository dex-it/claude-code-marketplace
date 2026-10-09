// Скрытые тесты K0: поведение не изменено. Пустой дифф src/ судья проверяет отдельно.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/app.js';
import { parseWeight } from '../src/parcel.js';

const post = (path, body) => handle({ method: 'POST', path, body, headers: {} }, { now: '2026-10-01T12:00:00Z', store: new Map(), queue: { publish() {} } });

test('K0 parseWeight(2.1) - 2100 г', () => {
  assert.equal(parseWeight(2.1), 2100);
});

test('K0 2.1 кг в зону B: расчётный 2.5 кг, цена полосы до 3 кг', async () => {
  const r = await post('/quote', { weight: 2.1, postcode: '20095' });
  assert.equal(r.status, 200);
  assert.equal(r.body.billableKg, 2.5);
  assert.equal(r.body.price, 6.9);
});

test('K0 0.3 кг - расчётный 0.5 кг; 2.5 кг - 2.5 кг', async () => {
  assert.equal((await post('/quote', { weight: 0.3, postcode: '20095' })).body.billableKg, 0.5);
  assert.equal((await post('/quote', { weight: 2.5, postcode: '20095' })).body.billableKg, 2.5);
});
