import { cancel, OrderStateError } from '../order.js';

const NOT_FOUND = { status: 404, body: { type: 'order-not-found' } };

export function toOrderResource(order) {
  const resource = {
    id: order.id,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
    total: order.totalKopecks / 100,
    items: order.items,
  };
  if (order.courierName) resource.courierName = order.courierName;
  if (order.trackingNumber) resource.trackingNumber = order.trackingNumber;
  return resource;
}

function findOwnOrder(store, id, customerId) {
  const order = store.get(id);
  if (!order || order.customerId !== customerId) return null;
  return order;
}

export function getOrder({ store, id, customerId }) {
  const order = findOwnOrder(store, id, customerId);
  if (!order) return NOT_FOUND;
  return { status: 200, body: toOrderResource(order) };
}

export function cancelOrder({ store, id, customerId, payments, stock }) {
  const order = findOwnOrder(store, id, customerId);
  if (!order) return NOT_FOUND;
  try {
    cancel(order, { payments, stock });
  } catch (error) {
    if (error instanceof OrderStateError) {
      return { status: 409, body: { type: 'cancel-forbidden', message: error.message } };
    }
    throw error;
  }
  store.put(order);
  return { status: 200, body: toOrderResource(order) };
}
