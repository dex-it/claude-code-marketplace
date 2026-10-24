import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerAtCarrier } from '../src/carrier.js';
import { makeCtx } from './ctx.js';

test('таймаут - повтор, второй ответ принят', async () => {
  let calls = 0;
  const carrier = { register: () => (++calls === 1 ? new Promise(() => {}) : Promise.resolve({ tracking: 'T2' })) };
  const ctx = makeCtx({ carrier, config: { CARRIER_TIMEOUT_MS: '20' } });
  assert.deepEqual(await registerAtCarrier({ id: 'S000001' }, ctx), { tracking: 'T2' });
  assert.equal(calls, 2);
});

test('три таймаута подряд - 504', async () => {
  const ctx = makeCtx({ carrier: { register: () => new Promise(() => {}) }, config: { CARRIER_TIMEOUT_MS: '10' } });
  await assert.rejects(registerAtCarrier({ id: 'S000001' }, ctx), { status: 504 });
});
