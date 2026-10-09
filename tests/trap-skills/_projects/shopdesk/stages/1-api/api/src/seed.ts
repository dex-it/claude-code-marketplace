import { OrderStatus, orderTotal, type OrderItem } from './domain/order.js';
import type { Product } from './domain/product.js';
import type { Store } from './store.js';

// Демо-данные для локального запуска и e2e. Пароли открытым текстом - только для демо-стенда.
export const demoUsers = {
  alice: { id: 'u-alice', email: 'alice@shopdesk.example', name: 'Алиса Смирнова', password: 'alice-demo' },
  bob: { id: 'u-bob', email: 'bob@shopdesk.example', name: 'Борис Петров', password: 'bob-demo' },
  admin: { id: 'u-admin', email: 'admin@shopdesk.example', name: 'Оператор', password: 'admin-demo' },
} as const;

const products: Product[] = [
  { id: 'p-mug', title: 'Кружка керамическая', priceKopecks: 129000 },
  { id: 'p-tea', title: 'Чай улун, 100 г', priceKopecks: 54900 },
  { id: 'p-kettle', title: 'Чайник стеклянный', priceKopecks: 349000 },
  { id: 'p-spoon', title: 'Ложка чайная', priceKopecks: 19900 },
  { id: 'p-tray', title: 'Поднос бамбуковый', priceKopecks: 215000 },
];

function line(productId: string, quantity: number): OrderItem {
  const product = products.find((p) => p.id === productId);
  if (!product) throw new Error(`unknown demo product ${productId}`);
  return { productId, title: product.title, quantity, priceKopecks: product.priceKopecks };
}

export function seedDemo(store: Store): void {
  store.users.set(demoUsers.alice.id, { ...demoUsers.alice, role: 'customer' });
  store.users.set(demoUsers.bob.id, { ...demoUsers.bob, role: 'customer' });
  store.users.set(demoUsers.admin.id, { ...demoUsers.admin, role: 'admin' });

  for (const product of products) store.products.set(product.id, product);

  const orders = [
    { id: 'ord-1001', number: 1001, customerId: demoUsers.alice.id, items: [line('p-mug', 1)], status: OrderStatus.New, createdAt: '2026-08-28T10:15:00.000Z' },
    { id: 'ord-1002', number: 1002, customerId: demoUsers.alice.id, items: [line('p-tea', 2), line('p-spoon', 2)], status: OrderStatus.New, createdAt: '2026-08-30T17:40:00.000Z' },
    { id: 'ord-1003', number: 1003, customerId: demoUsers.alice.id, items: [line('p-kettle', 1)], status: OrderStatus.Paid, createdAt: '2026-08-21T08:05:00.000Z' },
    { id: 'ord-1004', number: 1004, customerId: demoUsers.bob.id, items: [line('p-tray', 1)], status: OrderStatus.New, createdAt: '2026-08-31T12:00:00.000Z' },
  ];
  for (const order of orders) store.saveOrder({ ...order, totalKopecks: orderTotal(order.items) });
}
