import { readFileSync } from 'node:fs';
import { config } from '../config.js';
import { createStore } from '../store.js';
import { createServer } from './server.js';

const orders = JSON.parse(readFileSync(new URL('../../data/orders-sample.json', import.meta.url), 'utf8'));

// платёжный шлюз и склад на локальном запуске - заглушки с выводом в журнал
const payments = { refund: (orderId, kopecks) => console.log(`refund ${orderId}: ${kopecks} коп.`) };
const stock = { release: (items) => console.log(`release ${items.map((i) => `${i.sku} x${i.qty}`).join(', ')}`) };

createServer({ store: createStore(orders), payments, stock }).listen(config.port, '127.0.0.1', () => {
  console.log(`Parcel API: http://127.0.0.1:${config.port}`);
});
