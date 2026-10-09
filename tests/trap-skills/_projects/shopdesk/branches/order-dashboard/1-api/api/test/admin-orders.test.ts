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

async function login(app: ReturnType<typeof createApp>, who: keyof typeof demoUsers) {
  const { email, password } = demoUsers[who];
  const res = await request(app).post('/api/login').send({ email, password }).expect(200);
  return `Bearer ${res.body.token}`;
}

describe('admin orders api', () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    store = new Store();
    seedDemo(store);
    app = createApp({ store, payments, notifier, analytics });
  });

  it('lists all orders for admin', async () => {
    const auth = await login(app, 'admin');
    const res = await request(app).get('/api/admin/orders').set('Authorization', auth).expect(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toMatchObject({ number: 1004, discountKopecks: 0 });
  });

  it('is forbidden for customers and anonymous users', async () => {
    const auth = await login(app, 'alice');
    expect((await request(app).get('/api/admin/orders').set('Authorization', auth)).status).toBe(403);
    expect((await request(app).get('/api/admin/orders')).status).toBe(401);
  });

  it('updates delivery address with several recipients', async () => {
    const auth = await login(app, 'admin');
    const delivery = {
      city: 'Казань',
      street: 'ул. Баумана, 12',
      recipients: [
        { name: 'Алиса', phone: '+7 900 000-00-01' },
        { name: 'Ресепшн', phone: '+7 843 000-00-02' },
      ],
    };
    await request(app).put('/api/admin/orders/ord-1002/delivery').set('Authorization', auth).send(delivery).expect(200);
    expect(store.getOrder('ord-1002')?.delivery).toEqual(delivery);

    const bad = await request(app)
      .put('/api/admin/orders/ord-1002/delivery')
      .set('Authorization', auth)
      .send({ ...delivery, recipients: [] });
    expect(bad.status).toBe(400);
  });
});
