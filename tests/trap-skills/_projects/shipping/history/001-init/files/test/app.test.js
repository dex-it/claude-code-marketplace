import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/app.js';
import { makeCtx } from './ctx.js';

const post = (path, body, ctx = makeCtx()) => handle({ method: 'POST', path, body, headers: {} }, ctx);

test('POST /quote - цена по зоне и весу', async () => {
  const r = await post('/quote', { weight: 1, postcode: '10115' });
  assert.equal(r.status, 200);
  assert.equal(r.body.zone, 'A');
  assert.equal(r.body.price, 4.5);
});

test('POST /shipments - 201, сообщение в labels, GET по номеру', async () => {
  const ctx = makeCtx();
  const r = await post('/shipments', { weight: '2.1kg', postcode: '20095' }, ctx);
  assert.equal(r.status, 201);
  assert.equal(r.body.zone, 'B');
  assert.equal(r.body.billableKg, 2.5);
  assert.equal(ctx.queue.messages.length, 1);
  assert.equal(ctx.queue.messages[0].msg.weightGrams, 2100);
  const g = await handle({ method: 'GET', path: `/shipments/${r.body.id}`, headers: {} }, ctx);
  assert.equal(g.status, 200);
  assert.equal(g.body.tracking, r.body.tracking);
});

test('вес неизвестного формата - 400', async () => {
  const r = await post('/quote', { weight: '1.5lb', postcode: '10115' });
  assert.equal(r.status, 400);
});

test('индекс не из 5 цифр - 400', async () => {
  const r = await post('/quote', { weight: 1, postcode: '1011' });
  assert.equal(r.status, 400);
});

test('нет маршрута - 404', async () => {
  const r = await handle({ method: 'GET', path: '/nope', headers: {} }, makeCtx());
  assert.equal(r.status, 404);
});
