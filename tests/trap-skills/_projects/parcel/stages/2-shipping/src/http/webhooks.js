import { createCourierServiceClient } from '../carrier/courier-service.js';
import { config } from '../config.js';
import { pay } from '../order.js';
import { createShipmentForOrder } from '../shipping.js';

export function defaultCarrier() {
  return createCourierServiceClient({ baseUrl: config.courierService.url, apiKey: config.courierService.token });
}

// Платёжный шлюз шлёт { event, data: { order_id, amount_kopecks } }
export async function handlePaymentWebhook(body, { store, carrier = defaultCarrier() }) {
  if (body?.event !== 'payment.succeeded') return { status: 'ignored' };
  const order = store.get(body.data?.order_id);
  if (!order) return { status: 'unknown-order' };
  pay(order);
  await createShipmentForOrder(order, { carrier });
  store.put(order);
  return { status: 'processed', order };
}
