import type { OrderItem } from '../domain/order.js';

const INVENTORY_URL = process.env.INVENTORY_URL ?? 'http://localhost:4030';

export class TemporaryInventoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TemporaryInventoryError';
  }
}

export const inventory = {
  // Склад отвечает 201 и Location: /v1/reservations/<id>.
  async reserve(orderId: string, items: OrderItem[]): Promise<{ reservationId: string }> {
    let res: Response;
    try {
      res = await fetch(new URL('/v1/reservations', INVENTORY_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          lines: items.map((item) => ({ sku: item.productId, qty: item.quantity })),
        }),
      });
    } catch (err) {
      throw new TemporaryInventoryError('inventory is unreachable', { cause: err });
    }
    if (res.status === 503) {
      throw new TemporaryInventoryError('inventory is temporarily unavailable');
    }
    if (!res.ok) {
      throw new Error(`inventory responded with ${res.status}`);
    }
    const location = res.headers.get('location') ?? '';
    const reservationId = location.split('/').pop();
    if (!reservationId) {
      throw new Error('inventory response has no reservation location');
    }
    return { reservationId };
  },
};
