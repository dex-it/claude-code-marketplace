import { expect, it } from 'vitest';
import { harness, loginAlice, pay, settle, unhandled } from './harness.js';

it('M6: уже оплаченный заказ - 409, шлюз не вызывается', async () => {
  const ctx = harness();
  const res = await pay(ctx.app, await loginAlice(ctx.app), 'ord-1003');
  expect(res.status).toBe(409);
  expect(ctx.calls.charge).toHaveLength(0);
  await settle();
  expect(unhandled).toEqual([]);
});
