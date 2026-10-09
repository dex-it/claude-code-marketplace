import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Analytics } from '../src/analytics/analytics.js';
import { createApp } from '../src/app.js';
import type { Notifier } from '../src/notifications/notifier.js';
import type { PaymentGateway } from '../src/payments/gateway.js';
import { demoUsers, seedDemo } from '../src/seed.js';
import { Store } from '../src/store.js';

const payments: PaymentGateway = {
  async charge() {
    return { status: 'approved', transactionId: 'tx-test' };
  },
};
const notifier: Notifier = { async orderPaid() {} };
const analytics: Analytics = { async track() {} };

function setup() {
  const store = new Store();
  seedDemo(store);
  const app = createApp({ store, payments, notifier, analytics });
  return { store, app };
}

async function login(app: ReturnType<typeof setup>['app'], who: keyof typeof demoUsers) {
  const { email, password } = demoUsers[who];
  const res = await request(app).post('/api/login').send({ email, password }).expect(200);
  return `Bearer ${res.body.token}`;
}

describe('orders api', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('requires authentication', async () => {
    const res = await request(ctx.app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('lists only orders of the current customer', async () => {
    const auth = await login(ctx.app, 'alice');
    const res = await request(ctx.app).get('/api/orders').set('Authorization', auth).expect(200);
    expect(res.body.map((o: { number: number }) => o.number)).toEqual([1003, 1002, 1001]);
  });

  it('filters orders by number or product title', async () => {
    const auth = await login(ctx.app, 'alice');
    const byTitle = await request(ctx.app).get('/api/orders?q=ЧАЙ').set('Authorization', auth).expect(200);
    expect(byTitle.body.map((o: { number: number }) => o.number)).toEqual([1003, 1002]);
    const byNumber = await request(ctx.app).get('/api/orders?q=1001').set('Authorization', auth).expect(200);
    expect(byNumber.body).toHaveLength(1);
  });

  it('hides orders of other customers', async () => {
    const auth = await login(ctx.app, 'alice');
    const res = await request(ctx.app).get('/api/orders/ord-1004').set('Authorization', auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('order_not_found');
  });

  it('creates an order with prices from the catalog', async () => {
    const auth = await login(ctx.app, 'bob');
    const res = await request(ctx.app)
      .post('/api/orders')
      .set('Authorization', auth)
      .send({ items: [{ productId: 'p-mug', quantity: 2 }] })
      .expect(201);
    expect(res.body).toMatchObject({ number: 1005, status: 'new', totalKopecks: 258000 });
    expect(ctx.store.getOrder(res.body.id)?.customerId).toBe('u-bob');
  });

  it('rejects an invalid order body', async () => {
    const auth = await login(ctx.app, 'bob');
    const res = await request(ctx.app).post('/api/orders').set('Authorization', auth).send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('cancels a new order and refuses to cancel a paid one', async () => {
    const auth = await login(ctx.app, 'alice');
    const cancelled = await request(ctx.app).post('/api/orders/ord-1001/cancel').set('Authorization', auth).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    const paid = await request(ctx.app).post('/api/orders/ord-1003/cancel').set('Authorization', auth);
    expect(paid.status).toBe(409);
    expect(ctx.store.getOrder('ord-1003')?.status).toBe('paid');
  });
});
