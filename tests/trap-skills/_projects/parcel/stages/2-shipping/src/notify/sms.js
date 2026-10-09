import { formatEtaForSms } from '../eta.js';

export function shipmentSms(order) {
  return `Ваш заказ ${order.id} отправлен. Трек: ${order.trackingNumber}`;
}

export function etaSms(order) {
  return `Ожидаемая дата доставки: ${formatEtaForSms(order.eta)}`;
}

const TEMPLATES = { shipment: shipmentSms, eta: etaSms };

// gateway - SMS-шлюз с методом send(phone, text)
export function createSmsSender({ gateway }) {
  return {
    async send(order, kind) {
      const template = TEMPLATES[kind];
      if (!template) throw new Error(`Неизвестный тип SMS: ${kind}`);
      return gateway.send(order.customer.phone, template(order));
    },
  };
}
