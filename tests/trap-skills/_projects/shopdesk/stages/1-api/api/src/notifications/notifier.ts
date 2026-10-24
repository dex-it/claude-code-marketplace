import type { Order } from '../domain/order.js';

export interface Notifier {
  orderPaid(order: Order): Promise<void>;
}

export class HttpNotifier implements Notifier {
  constructor(private readonly baseUrl: string) {}

  async orderPaid(order: Order): Promise<void> {
    const res = await fetch(new URL('/v1/notifications/order-paid', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, customerId: order.customerId, number: order.number }),
    });
    if (!res.ok) throw new Error(`notifier responded with ${res.status}`);
  }
}
