import { expect, it } from 'vitest';
import { harness, loginAlice, pay, settle, unhandled } from './harness.js';

it('M1: одобренное списание - 200, заказ paid', async () => {
  const ctx = harness();
  const res = await pay(ctx.app, await loginAlice(ctx.app), 'ord-1001');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('paid');
  expect(ctx.store.getOrder('ord-1001')?.status).toBe('paid');
  expect(ctx.calls.charge).toHaveLength(1);
  expect(ctx.calls.charge[0]).toMatchObject({ orderId: 'ord-1001', amountKopecks: 129000, currency: 'RUB' });
  await settle();
  expect(unhandled).toEqual([]);
});
