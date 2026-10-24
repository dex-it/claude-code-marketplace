import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insuranceFee } from '../src/insurance.js';
import { handle } from '../src/app.js';
import { processJob } from '../worker/label.js';
import { makeCtx } from './ctx.js';

const post = (path, body, ctx = makeCtx()) => handle({ method: 'POST', path, body, headers: {} }, ctx);

test('надбавка - 1 % страховой суммы, declaredValue в центах', () => {
  assert.equal(insuranceFee(20000, 'B'), 2);
  assert.equal(insuranceFee(5000, 'A'), 0.5);
});

test('зона D не страхуется - 422', () => {
  assert.throws(() => insuranceFee(20000, 'D'), { status: 422 });
});

test('котировка со страховкой', async () => {
  const r = await post('/quote', { weight: 1, postcode: '10115', declaredValue: 30000 });
  assert.equal(r.status, 200);
  assert.equal(r.body.insurance, 3);
  assert.equal(r.body.price, 7.5);
});

test('отправление со страховкой - 201, страховка в сообщении', async () => {
  const ctx = makeCtx();
  const r = await post('/shipments', { weight: 1, postcode: '10115', declaredValue: 50000 }, ctx);
  assert.equal(r.status, 201);
  assert.equal(ctx.queue.messages[0].msg.insured, true);
  assert.equal(ctx.queue.messages[0].msg.insuredAmount, 500);
});

test('страховая сумма больше 1000 EUR - 422', async () => {
  const r = await post('/shipments', { weight: 1, postcode: '10115', declaredValue: 150000 });
  assert.equal(r.status, 422);
});

test('этикетка застрахованного отправления', () => {
  const t = processJob({ id: 'S000001', tracking: 'T', postcode: '10115', zone: 'A', weightGrams: 1000, insured: true, insuredAmount: 5 });
  assert.match(t, /Страховка: 5\.00 EUR/);
});

test('котировка: лимит 1000 EUR и в /quote - 100000 принимается, 100001 даёт 422', async () => {
  const ok = await post('/quote', { weight: 1, postcode: '10115', declaredValue: 100000 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.insurance, 10);
  const over = await post('/quote', { weight: 1, postcode: '10115', declaredValue: 100001 });
  assert.equal(over.status, 422);
});
