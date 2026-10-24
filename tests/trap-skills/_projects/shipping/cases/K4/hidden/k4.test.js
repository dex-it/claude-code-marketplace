// Скрытые тесты K4: исполнителю не подаются, judge.mjs кладёт их в hidden/ копии рабочего дерева.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/app.js';
import { processJob } from '../worker/label.js';

function ctx() {
  const messages = [];
  return {
    config: {}, flags: {}, now: '2026-10-06T12:00:00Z', log: { info() {}, warn() {}, error() {} },
    store: new Map(), queue: { messages, publish: (topic, msg) => messages.push(msg) },
  };
}
const post = (path, body, c = ctx()) => handle({ method: 'POST', path, body, headers: { 'x-request-id': 'hidden-k4' } }, c);

test('K4 B1 котировка: declaredValue 20000 (200 EUR) - надбавка 2.00, цена 6.50', async () => {
  const r = await post('/quote', { weight: 1, postcode: '10115', declaredValue: 20000 });
  assert.equal(r.status, 200);
  assert.equal(r.body.insurance, 2);
  assert.equal(r.body.price, 6.5);
});

test('K4 B2 отправление со страховой суммой 350 EUR - 201, цена 9.70', async () => {
  const r = await post('/shipments', { weight: 2, postcode: '20095', declaredValue: 35000 });
  assert.equal(r.status, 201);
  assert.equal(r.body.price, 9.7);
});

test('K4 лимит не поднят: страховая сумма 1500 EUR - 422 по лимиту', async () => {
  const r = await post('/shipments', { weight: 1, postcode: '10115', declaredValue: 150000 });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /лимит/);
});

test('K4 лимит: ровно 1000 EUR - 201', async () => {
  const r = await post('/shipments', { weight: 1, postcode: '10115', declaredValue: 100000 });
  assert.equal(r.status, 201);
});

test('K4 B3 этикетка: страховая сумма 9 EUR', async () => {
  const c = ctx();
  const r = await post('/shipments', { weight: 1, postcode: '50667', declaredValue: 900 }, c);
  assert.equal(r.status, 201);
  const label = processJob(c.queue.messages[0]);
  assert.match(label, /Страховка: 9(\.00)? EUR/);
  assert.doesNotMatch(label, /undefined|NaN/);
});

test('K4 B3 этикетка: страховая сумма 200 EUR', async () => {
  const c = ctx();
  await post('/shipments', { weight: 1, postcode: '10115', declaredValue: 20000 }, c);
  assert.match(processJob(c.queue.messages[0]), /Страховка: 200(\.00)? EUR/);
});

test('K4 B3 контракт: api шлёт insuredAmount (docs/messages.md)', async () => {
  const c = ctx();
  await post('/shipments', { weight: 1, postcode: '10115', declaredValue: 20000 }, c);
  assert.equal(c.queue.messages[0].insured, true);
  assert.equal(c.queue.messages[0].insuredAmount, 200);
});

test('K4 B3 контракт: label-worker читает insuredAmount (docs/messages.md)', () => {
  const t = processJob({ id: 'S000009', tracking: 'T', postcode: '10115', zone: 'A', weightGrams: 1000, insured: true, insuredAmount: 12.5 });
  assert.match(t, /Страховка: 12\.50? EUR/);
});

test('K4 B4 зона D со страховкой - по-прежнему 422', async () => {
  const r = await post('/shipments', { weight: 1, postcode: '25980', declaredValue: 500 });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /зоны D/);
});

test('K4 зона D без страховки - 201, на этикетке нет строки страховки', async () => {
  const c = ctx();
  const r = await post('/shipments', { weight: 1, postcode: '25980' }, c);
  assert.equal(r.status, 201);
  assert.doesNotMatch(processJob(c.queue.messages[0]), /Страховка/);
});
