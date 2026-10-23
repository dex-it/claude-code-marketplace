const DELIVERY_URL = process.env.DELIVERY_URL ?? 'http://localhost:4040';

export class DeliveryUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DeliveryUnavailableError';
  }
}

export interface DeliveryQuote {
  priceKopecks: number;
  days: number;
}

export const delivery = {
  // Служба доставки отвечает 200 и { price_kopecks, days }.
  async quote(city: string, weightGrams: number): Promise<DeliveryQuote> {
    let res: Response;
    try {
      res = await fetch(new URL('/v1/quotes', DELIVERY_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, weight_g: weightGrams }),
      });
    } catch (err) {
      throw new DeliveryUnavailableError('delivery is unreachable', { cause: err });
    }
    if (res.status === 503) {
      throw new DeliveryUnavailableError('delivery is temporarily unavailable');
    }
    if (!res.ok) {
      throw new Error(`delivery responded with ${res.status}`);
    }
    const body = (await res.json()) as { price_kopecks?: unknown; days?: unknown };
    if (typeof body.price_kopecks !== 'number' || typeof body.days !== 'number') {
      throw new Error('delivery response has no price');
    }
    return { priceKopecks: body.price_kopecks, days: body.days };
  },
};
