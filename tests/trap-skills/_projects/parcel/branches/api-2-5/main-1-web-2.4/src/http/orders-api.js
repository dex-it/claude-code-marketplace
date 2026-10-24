import { cancel, OrderStateError, returnOrder } from '../order.js';

const NOT_FOUND = { status: 404, body: { type: 'order-not-found' } };

export function toOrderResource(order) {
  const resource = {
    id: order.id,
    status: order.status,
    createdAt: Date.parse(order.createdAt),
    total: order.totalKopecks,
    courier: order.courierName ? { name: order.courierName, phone: order.courierPhone } : null,
    trackingNumber: order.trackingNumber ?? null,
    eta: order.eta ?? null,
    items: order.items,
  };
  if (order.giftMessage) resource.giftMessage = order.giftMessage;
  return resource;
}

function findOwnOrder(store, id, customerId) {
  const order = store.get(id);
  if (!order || order.customerId !== customerId) return null;
  return order;
}

function archivedOrder(archive, id) {
  const order = archive.get(id);
  if (!order) return { status: 404, body: { type: 'not_found' } };
  return { status: 200, body: toOrderResource(order) };
}

export function getOrder({ store, archive, id }) {
  if (archive?.covers(id)) return archivedOrder(archive, id);
  const order = store.get(id);
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
  return { status: 204 };
}

export function requestReturn({ store, id, customerId, payments, now = new Date() }) {
  const order = findOwnOrder(store, id, customerId);
  if (!order) return NOT_FOUND;
  try {
    returnOrder(order, { now, payments });
  } catch (error) {
    if (error instanceof OrderStateError) {
      return { status: 409, body: { type: 'return-forbidden', message: error.message } };
    }
    throw error;
  }
  store.put(order);
  return { status: 204 };
}
