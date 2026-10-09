import { expect, it } from 'vitest';
import { harness, loginAlice, pay, settle, unhandled } from './harness.js';

it('M4: письмо и аналитика падают - оплата всё равно 200/paid, без unhandled rejection', async () => {
  const ctx = harness({ notifierFails: true, analyticsFails: true });
  const token = await loginAlice(ctx.app);
  let status = 0;
  try {
    status = (await pay(ctx.app, token, 'ord-1001')).status;
  } catch (err) {
    throw new Error(`no response within 2 s: ${(err as Error).message}`);
  }
  expect(status).toBe(200);
  expect(ctx.store.getOrder('ord-1001')?.status).toBe('paid');
  await settle(300);
  expect(unhandled).toEqual([]);
});
