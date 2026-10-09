import { quote } from './tariff.js';

export class OrderStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderStateError';
    this.code = code;
  }
}

const CANCELLABLE = ['created', 'paid', 'packed'];
const RETURN_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

let lastId = 1100;

export function createOrder(data) {
  const { customer, address } = data;
  const { zone, totalKopecks } = quote({
    weightKg: data.weightKg,
    postcode: address.postcode,
    express: data.express,
    fragile: data.fragile,
    loyalty: data.loyalty,
  });
  return {
    id: data.id ?? ++lastId,
    customerId: data.customerId,
    customer: { name: customer.name, phone: customer.phone },
    address: { postcode: address.postcode, line: address.line },
    items: data.items.map(({ sku, qty }) => ({ sku, qty })),
    weightKg: data.weightKg,
    zone,
    express: Boolean(data.express),
    fragile: Boolean(data.fragile),
    totalKopecks,
    status: 'created',
    createdAt: new Date().toISOString(),
    history: [],
  };
}

function record(order, status, at = new Date()) {
  order.status = status;
  order.history.push({ status, at: new Date(at).toISOString() });
}

function move(order, from, to, at) {
  if (!from.includes(order.status)) {
    throw new OrderStateError('TRANSITION', `Переход ${order.status} -> ${to} недопустим`);
  }
  record(order, to, at);
  return order;
}

export function pay(order, { amountKopecks } = {}) {
  move(order, ['created'], 'paid');
  if (amountKopecks !== undefined) order.paidKopecks = amountKopecks;
  return order;
}

export function pack(order) {
  return move(order, ['paid'], 'packed');
}

export function ship(order, { trackingNumber, at = new Date() } = {}) {
  move(order, ['packed'], 'shipped', at);
  order.trackingNumber = trackingNumber;
  order.shippedAt = new Date(at).toISOString();
  return order;
}

export function deliver(order, { at = new Date() } = {}) {
  move(order, ['shipped'], 'delivered', at);
  order.deliveredAt = new Date(at).toISOString();
  return order;
}

export function cancel(order, { payments, stock }) {
  if (!CANCELLABLE.includes(order.status)) {
    throw new OrderStateError('CANCEL_FORBIDDEN', `Заказ в статусе ${order.status} нельзя отменить`);
  }
  if (order.status !== 'created') payments.refund(order.id, order.paidKopecks ?? order.totalKopecks);
  stock.release(order.items);
  record(order, 'cancelled');
  return order;
}

function withinReturnWindow(order, now) {
  const days = Math.floor((new Date(now) - new Date(order.deliveredAt)) / DAY_MS);
  return days <= RETURN_WINDOW_DAYS;
}

export async function returnOrder(order, { now = new Date(), payments }) {
  if (order.status !== 'delivered' || !withinReturnWindow(order, now)) {
    throw new OrderStateError('RETURN_FORBIDDEN', `Возврат заказа ${order.id} невозможен`);
  }
  console.log('return requested', order.id, order.customer.phone);
  record(order, 'returned', now);
  payments.refund(order.id, order.totalKopecks);
  return order;
}
