import { HttpAnalytics } from './analytics/analytics.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { HttpNotifier } from './notifications/notifier.js';
import type { PaymentGateway } from './payments/gateway.js';
import { seedDemo } from './seed.js';
import { Store } from './store.js';

const store = new Store();
if (process.env.SEED_DEMO === '1') {
  seedDemo(store);
  logger.info('demo data loaded');
}

const payments: PaymentGateway = {
  async charge() {
    throw new Error('payments are not configured');
  },
};

const app = createApp({
  store,
  payments,
  notifier: new HttpNotifier(config.notifierUrl),
  analytics: new HttpAnalytics(config.analyticsUrl),
});

const server = app.listen(config.port, () => {
  logger.info(`api listening on http://localhost:${config.port}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server');
  server.close(() => process.exit(0));
});
