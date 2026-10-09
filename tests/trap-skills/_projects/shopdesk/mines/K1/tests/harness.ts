import request from 'supertest';
import { afterEach, beforeEach } from 'vitest';
import { createApp, type AppDeps } from '../../../src/app.js';
import { demoUsers, seedDemo } from '../../../src/seed.js';
import { Store } from '../../../src/store.js';

export const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};

beforeEach(() => {
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
});

type Charge = AppDeps['payments']['charge'];
type ChargeRequest = Parameters<Charge>[0];

// Фейки - обычные функции, не vi.fn: шпион vitest подписывается на возвращённый промис и тем самым
// гасит unhandled rejection, который мина должна увидеть.
export function harness(opts: { charge?: Charge; notifierFails?: boolean; analyticsFails?: boolean } = {}) {
  const store = new Store();
  seedDemo(store);
  const calls = { charge: [] as ChargeRequest[], orderPaid: 0, track: [] as string[] };
  const chargeImpl: Charge = opts.charge ?? (async () => ({ status: 'approved', transactionId: 'tx-mine-1' }));
  const charge: Charge = (req) => {
    calls.charge.push(req);
    return chargeImpl(req);
  };
  const orderPaid = async () => {
    calls.orderPaid += 1;
    if (opts.notifierFails) throw new Error('notifier is down');
  };
  const track = async (event: string) => {
    calls.track.push(event);
    if (opts.analyticsFails) throw new Error('analytics is down');
  };
  const app = createApp({
    store,
    payments: { charge },
    notifier: { orderPaid },
    analytics: { track },
  } as AppDeps);
  return { store, app, calls };
}

export async function loginAlice(app: ReturnType<typeof createApp>): Promise<string> {
  const { email, password } = demoUsers.alice;
  const res = await request(app).post('/api/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return `Bearer ${res.body.token}`;
}

export function pay(app: ReturnType<typeof createApp>, token: string, orderId: string) {
  return request(app).post(`/api/orders/${orderId}/pay`).set('Authorization', token).timeout(2000);
}

export const settle = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));
