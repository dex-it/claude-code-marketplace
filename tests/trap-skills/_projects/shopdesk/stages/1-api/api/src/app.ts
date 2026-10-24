import express from 'express';
import type { Analytics } from './analytics/analytics.js';
import { createSession, currentUser, requireUser, type SessionUser } from './auth.js';
import { OrderStatus, type Order, type OrderItem } from './domain/order.js';
import { HttpError, errorHandler } from './errors.js';
import type { Notifier } from './notifications/notifier.js';
import type { PaymentGateway } from './payments/gateway.js';
import type { Store } from './store.js';
import { createOrderSchema, loginSchema, parseBody } from './validation.js';

export interface AppDeps {
  store: Store;
  payments: PaymentGateway;
  notifier: Notifier;
  analytics: Analytics;
}

function findOwnOrder(store: Store, user: SessionUser, id: string): Order {
  const order = store.getOrder(id);
  if (!order || order.customerId !== user.id) {
    throw new HttpError(404, 'order_not_found', `Order ${id} not found`);
  }
  return order;
}

function matchesQuery(order: Order, q: string): boolean {
  if (String(order.number).includes(q)) return true;
  return order.items.some((item) => item.title.toLowerCase().includes(q));
}

export function createApp(deps: AppDeps): express.Express {
  const { store } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.post('/api/login', (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = store.findUserByEmail(email);
    if (!user || user.password !== password) {
      throw new HttpError(401, 'invalid_credentials', 'Invalid email or password');
    }
    const token = createSession(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  app.get('/api/products', (_req, res) => {
    res.json(store.listProducts());
  });

  app.get('/api/products/:id', (req, res) => {
    const product = store.getProduct(req.params.id);
    if (!product) throw new HttpError(404, 'product_not_found', `Product ${req.params.id} not found`);
    res.json(product);
  });

  const orders = express.Router();
  orders.use(requireUser);

  orders.get('/', (req, res) => {
    const user = currentUser(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const list = store.listOrdersByCustomer(user.id);
    res.json(q ? list.filter((order) => matchesQuery(order, q)) : list);
  });

  orders.get('/:id', (req, res) => {
    res.json(findOwnOrder(store, currentUser(req), req.params.id));
  });

  orders.post('/', (req, res) => {
    const user = currentUser(req);
    const input = parseBody(createOrderSchema, req.body);
    const items: OrderItem[] = input.items.map(({ productId, quantity }) => {
      const product = store.getProduct(productId);
      if (!product) throw new HttpError(400, 'product_not_found', `Product ${productId} not found`);
      return { productId, title: product.title, quantity, priceKopecks: product.priceKopecks };
    });
    res.status(201).json(store.createOrder(user.id, items));
  });

  orders.post('/:id/cancel', (req, res) => {
    const order = findOwnOrder(store, currentUser(req), req.params.id);
    if (order.status !== OrderStatus.New) {
      throw new HttpError(409, 'order_not_cancellable', `Order ${order.number} is ${order.status}`);
    }
    res.json(store.saveOrder({ ...order, status: OrderStatus.Cancelled }));
  });

  app.use('/api/orders', orders);
  app.use(errorHandler);
  return app;
}
