import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Analytics } from '../src/analytics/analytics.js';
import { createApp } from '../src/app.js';
import type { Notifier } from '../src/notifications/notifier.js';
import type { PaymentGateway } from '../src/payments/gateway.js';
import { demoUsers, seedDemo } from '../src/seed.js';
import { Store } from '../src/store.js';

vi.mock('../src/clients/refunds-provider.js', () => ({
  refundsProvider: {
    refund: vi.fn(async () => ({ providerRefundId: 'rf-test-1' })),
  },
}));

const payments: PaymentGateway = {
  async charge() {
    return { status: 'approved', transactionId: 'tx-test' };
  },
};
const notifier: Notifier = { async orderPaid() {} };
const analytics: Analytics = { async track() {} };

async function login(app: ReturnType<typeof createApp>, who: keyof typeof demoUsers) {
  const { email, password } = demoUsers[who];
  const res = await request(app).post('/api/login').send({ email, password }).expect(200);
  return `Bearer ${res.body.token}`;
}

describe('admin refunds', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.AUDIT_LOG = join(tmpdir(), 'shopdesk-audit-test.log');
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 202 })));
    const store = new Store();
    seedDemo(store);
    app = createApp({ store, payments, notifier, analytics });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not available to customers', async () => {
    const auth = await login(app, 'alice');
    const res = await request(app).get('/api/admin/refunds').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('registers a partial refund for a paid order', async () => {
    const auth = await login(app, 'admin');
    const res = await request(app)
      .post('/api/admin/refunds')
      .set('Authorization', auth)
      .send({ orderId: 'ord-1003', items: ['p-kettle'], amountKopecks: 100000, reason: 'Скол на крышке' })
      .expect(201);

    expect(res.body).toMatchObject({
      orderId: 'ord-1003',
      status: 'completed',
      providerRefundId: 'rf-test-1',
      orderBalanceKopecks: 249000,
    });

    const list = await request(app).get('/api/admin/refunds').set('Authorization', auth).expect(200);
    expect(list.body.map((r: { id: string }) => r.id)).toContain(res.body.id);
  });

  it('shows refunds of the same order', async () => {
    const auth = await login(app, 'admin');
    const created = await request(app)
      .post('/api/admin/refunds')
      .set('Authorization', auth)
      .send({ orderId: 'ord-1003', items: ['p-kettle'], amountKopecks: 50000, reason: 'Задержка доставки' })
      .expect(201);

    const res = await request(app).get(`/api/admin/refunds/${created.body.id}`).set('Authorization', auth).expect(200);
    expect(res.body.orderRefunds.length).toBeGreaterThanOrEqual(1);
  });
});
