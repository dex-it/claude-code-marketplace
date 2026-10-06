import { expect, it } from 'vitest';
import { harness, loginAlice, pay, settle, unhandled } from './harness.js';

it('M5: чужой заказ - 404, шлюз не вызывается', async () => {
  const ctx = harness();
  const res = await pay(ctx.app, await loginAlice(ctx.app), 'ord-1004');
  expect(res.status).toBe(404);
  expect(ctx.calls.charge).toHaveLength(0);
  expect(ctx.store.getOrder('ord-1004')?.status).toBe('new');
  await settle();
  expect(unhandled).toEqual([]);
});
