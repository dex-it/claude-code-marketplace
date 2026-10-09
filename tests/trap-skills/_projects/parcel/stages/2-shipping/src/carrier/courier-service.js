import { CarrierError } from './errors.js';

export function createCourierServiceClient({ baseUrl, apiKey, fetchImpl = fetch }) {
  return {
    name: 'courier-service',

    async createShipment(order) {
      const request = {
        ref: String(order.id),
        weight: order.weightKg,
        to: {
          zip: order.address.postcode,
          address: order.address.line,
          name: order.customer.name,
          phone: order.customer.phone,
        },
      };
      let res;
      try {
        res = await fetchImpl(`${baseUrl}/api/orders`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify(request),
        });
      } catch (error) {
        throw new CarrierError(`Курьер-Сервис недоступен: ${error.message}`, { carrier: 'courier-service' });
      }
      if (!res.ok) {
        const text = await res.text();
        throw new CarrierError(`Курьер-Сервис ответил ${res.status}: ${text}`, { carrier: 'courier-service', status: res.status });
      }
      const body = await res.json();
      return { trackingNumber: body.trackNo, eta: body.deliveryDate };
    },
  };
}
