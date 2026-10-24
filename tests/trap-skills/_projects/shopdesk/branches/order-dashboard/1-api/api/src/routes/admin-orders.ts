import express from 'express';
import { requireAdmin, requireUser } from '../auth.js';
import type { Order } from '../domain/order.js';
import { HttpError } from '../errors.js';
import type { Store } from '../store.js';
import { deliverySchema, parseBody } from '../validation.js';

function getOrder(store: Store, id: string): Order {
  const order = store.getOrder(id);
  if (!order) throw new HttpError(404, 'order_not_found', `Order ${id} not found`);
  return order;
}

export function adminOrdersRouter(store: Store): express.Router {
  const router = express.Router();
  router.use(requireUser, requireAdmin);

  router.get('/orders', (_req, res) => {
    res.json(store.listOrders());
  });

  router.get('/orders/:id', (req, res) => {
    res.json(getOrder(store, req.params.id));
  });

  router.put('/orders/:id/delivery', (req, res) => {
    const order = getOrder(store, req.params.id);
    const delivery = parseBody(deliverySchema, req.body);
    res.json(store.saveOrder({ ...order, delivery }));
  });

  return router;
}
