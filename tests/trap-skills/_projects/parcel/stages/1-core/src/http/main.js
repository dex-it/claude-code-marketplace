import { readFileSync } from 'node:fs';
import { createStore } from '../store.js';
import { createServer } from './server.js';

const orders = JSON.parse(readFileSync(new URL('../../data/orders-sample.json', import.meta.url), 'utf8'));
const port = Number(process.env.PORT ?? 3000);

// платёжный шлюз и склад на локальном запуске - заглушки с выводом в журнал
const payments = { refund: (orderId, kopecks) => console.log(`refund ${orderId}: ${kopecks} коп.`) };
const stock = { release: (items) => console.log(`release ${items.map((i) => `${i.sku} x${i.qty}`).join(', ')}`) };

createServer({ store: createStore(orders), payments, stock }).listen(port, '127.0.0.1', () => {
  console.log(`Parcel API: http://127.0.0.1:${port}`);
});
