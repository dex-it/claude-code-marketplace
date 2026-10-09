// Скрытые тесты K1: исполнителю не подаются, judge.mjs кладёт их в hidden/ копии рабочего дерева.
// Тесты с «справочно» в имени в вердикт K1 не входят.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/app.js';
import { processJob } from '../worker/label.js';
import { parseWeight } from '../src/parcel.js';
import { zoneFor } from '../src/zones.js';

function ctx() {
  const messages = [];
  return {
    config: {}, flags: {}, now: '2026-10-06T12:00:00Z', log: { info() {}, warn() {}, error() {} },
    store: new Map(), queue: { messages, publish: (topic, msg) => messages.push(msg) },
  };
}
const post = (path, body, c = ctx()) => handle({ method: 'POST', path, body, headers: { 'x-request-id': 'hidden-k1' } }, c);

test('K1 вес "1,5": POST /shipments - 201, вес 1500 г, цена полосы до 2 кг зоны A', async () => {
  const r = await post('/shipments', { weight: '1,5', postcode: '10115' });
  assert.equal(r.status, 201);
  assert.equal(r.body.weightGrams, 1500);
  assert.equal(r.body.price, 5.2);
});

test('K1 вес "1,5": POST /quote - 200, расчётный 1,5 кг, цена полосы до 2 кг зоны B', async () => {
  const r = await post('/quote', { weight: '1,5', postcode: '20095' });
  assert.equal(r.status, 200);
  assert.equal(r.body.billableKg, 1.5);
  assert.equal(r.body.price, 6.2);
});

test('K1 вес "2,3": POST /quote - расчётный 2,5 кг, цена полосы до 3 кг зоны C', async () => {
  const r = await post('/quote', { weight: '2,3', postcode: '50667' });
  assert.equal(r.status, 200);
  assert.equal(r.body.billableKg, 2.5);
  assert.equal(r.body.price, 8.9);
});

test('K1 этикетка по отправлению с весом "1,5" печатает 1.5 кг', async () => {
  const c = ctx();
  const r = await post('/shipments', { weight: '1,5', postcode: '10115' }, c);
  assert.equal(r.status, 201);
  assert.match(processJob(c.queue.messages[0]), /Вес: 1\.5 кг/);
});

test('K1 индекс "01067": POST /shipments - 201, зона B, срок 1-2', async () => {
  const r = await post('/shipments', { weight: 2, postcode: '01067' });
  assert.equal(r.status, 201);
  assert.equal(r.body.zone, 'B');
  assert.equal(r.body.deliveryDays, '1-2');
  assert.equal(r.body.price, 6.2);
});

test('K1 индекс "01067": POST /quote - зона B', async () => {
  const r = await post('/quote', { weight: 2, postcode: '01067' });
  assert.equal(r.status, 200);
  assert.equal(r.body.zone, 'B');
});

test('K1 этикетка по индексу "01067": индекс с нулём и зона B', async () => {
  const c = ctx();
  await post('/shipments', { weight: 2, postcode: '01067' }, c);
  assert.match(processJob(c.queue.messages[0]), /Индекс 01067, зона B/);
});

test('K1 источник веса: parseWeight("1,5") - 1500', () => {
  assert.equal(parseWeight('1,5'), 1500);
});

test('K1 источник зоны: zoneFor("01067") - B', () => {
  assert.equal(zoneFor('01067'), 'B');
});

test('K1 прочие индексы и острова не сломаны', async () => {
  for (const [pc, zone] of [['10115', 'A'], ['20095', 'B'], ['80331', 'C'], ['99084', 'B'], ['25980', 'D'], ['18565', 'D']]) {
    const r = await post('/quote', { weight: 1, postcode: pc });
    assert.equal(r.body.zone, zone, pc);
  }
});

test('K1 справочно: вес "1;5" - 400, не 500', async () => {
  const r = await post('/quote', { weight: '1;5', postcode: '10115' });
  assert.equal(r.status, 400);
});

test('K1 справочно O1: ответ 500 без стека', async () => {
  const c = ctx();
  c.store = { get size() { throw new Error('boom'); }, get() {}, set() {} };
  const r = await post('/shipments', { weight: 1, postcode: '10115' }, c);
  assert.equal(r.status, 500);
  assert.equal(r.body.stack, undefined);
});
