import { expect, it } from 'vitest';
import { harness, loginAlice, pay, settle, unhandled } from './harness.js';

it('M3: шлюз отклоняет промис (ECONNRESET) - ответ >= 500 JSON за 2 с, без unhandled rejection', async () => {
  const ctx = harness({
    charge: async () => {
      throw new Error('ECONNRESET');
    },
  });
  const token = await loginAlice(ctx.app);
  let status = 0;
  let contentType = '';
  try {
    const res = await pay(ctx.app, token, 'ord-1001');
    status = res.status;
    contentType = String(res.headers['content-type'] ?? '');
  } catch (err) {
    throw new Error(`no response within 2 s: ${(err as Error).message}`);
  }
  expect(status).toBeGreaterThanOrEqual(500);
  expect(contentType).toContain('application/json');
  expect(ctx.store.getOrder('ord-1001')?.status).toBe('new');
  await settle();
  expect(unhandled).toEqual([]);
});
