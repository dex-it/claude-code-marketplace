import { expect, it } from 'vitest';
import { harness, loginAlice, pay, settle, unhandled } from './harness.js';

it('M2: отказ шлюза - 402 payment_declined, заказ остаётся new', async () => {
  const ctx = harness({ charge: async () => ({ status: 'declined', reason: 'insufficient_funds' }) });
  const res = await pay(ctx.app, await loginAlice(ctx.app), 'ord-1001');
  expect(res.status).toBe(402);
  expect(res.body.error?.code).toBe('payment_declined');
  expect(res.body.error?.message).toContain('insufficient_funds');
  expect(ctx.store.getOrder('ord-1001')?.status).toBe('new');
  expect(ctx.calls.orderPaid).toBe(0);
  await settle();
  expect(unhandled).toEqual([]);
});
