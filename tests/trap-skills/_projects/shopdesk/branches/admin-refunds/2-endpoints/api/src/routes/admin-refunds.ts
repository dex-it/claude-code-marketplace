import express, { type Request, type Response } from 'express';
import type { AppDeps } from '../app.js';
import { audit } from '../audit.js';
import { currentUser, requireAdmin } from '../auth.js';
import { refundsProvider } from '../clients/refunds-provider.js';
import { config } from '../config.js';
import { OrderStatus } from '../domain/order.js';
import { RefundStatus, type Refund } from '../domain/refund.js';
import { HttpError } from '../errors.js';
import { logger } from '../logger.js';
import { refunds } from '../refunds/refund-store.js';
import { createRefundSchema, type CreateRefund } from '../validation.js';

async function notifyCustomer(refund: Refund): Promise<void> {
  const res = await fetch(new URL('/v1/notifications/refund', config.notifierUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: refund.orderId, refundId: refund.id, amountKopecks: refund.amountKopecks }),
  });
  if (!res.ok) throw new Error(`notifier responded with ${res.status}`);
}

export function adminRefundsRouter(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(express.json());

  router.use((req, _res, next) => {
    audit.record({ action: `${req.method} ${req.originalUrl}`, ip: req.ip });
    next();
  });

  router.get('/refunds', requireAdmin, async (_req, res) => {
    res.json(await refunds.list());
  });

  router.get('/refunds/:id', requireAdmin, async (req, res) => {
    const refund = await refunds.get(req.params.id);
    if (!refund) throw new HttpError(404, 'refund_not_found', `Refund ${req.params.id} not found`);
    const orderRefunds = await refunds.listByOrder(refund.orderId);
    res.json({ ...refund, orderRefunds });
  });

  router.post('/refunds', requireAdmin, async (req, res) => {
    const admin = currentUser(req);
    const body = createRefundSchema.parse(req.body) as CreateRefund;
    const order = deps.store.orders.get(body.orderId)!;
    if (order.status !== OrderStatus.Paid) {
      throw new HttpError(409, 'order_not_paid', `Order ${order.number} is ${order.status}`);
    }
    if (body.amountKopecks > order.totalKopecks) {
      throw new HttpError(422, 'refund_exceeds_order', 'Refund amount exceeds order total');
    }

    const existing = await refunds.listByOrder(order.id);
    if (existing.some((r) => r.orderId === body.orderId && r.items === body.items)) {
      throw new HttpError(409, 'refund_duplicate', 'The same refund is already registered');
    }

    const refund = await refunds.create({
      orderId: order.id,
      items: body.items,
      amountKopecks: body.amountKopecks,
      reason: body.reason,
      createdBy: admin.id,
    });
    const { providerRefundId } = await refundsProvider.refund({
      orderId: order.id,
      amountKopecks: body.amountKopecks,
      reason: body.reason,
    });
    const completed = await refunds.save({
      ...refund,
      providerRefundId,
      status: RefundStatus.Completed,
      orderBalanceKopecks: order.totalKopecks - body.amountKopecks,
    });
    audit.record({ actor: admin.id, action: `refund ${completed.id} for order ${order.number}` });

    try {
      notifyCustomer(completed);
    } catch (err) {
      logger.error(`refund notification for order ${order.number} failed`, err);
    }

    res.status(201).json(completed);
  });

  router.patch('/refunds/:id', async (req, res) => {
    const refund = await refunds.get(req.params.id);
    if (!refund) throw new HttpError(404, 'refund_not_found', `Refund ${req.params.id} not found`);
    refund.status = req.body.status;
    res.json(await refunds.save(refund));
  });

  router.use((err: Error, req: Request, res: Response) => {
    logger.error(`admin ${req.method} ${req.originalUrl} failed`, err);
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: { code: 'admin_error', message: err.message } });
  });

  return router;
}
