import { delivery, DeliveryUnavailableError } from '../clients/delivery.js';
import { orderTotal, type OrderItem } from '../domain/order.js';
import { logger } from '../logger.js';
import { applyPromo } from './promo.js';

const GRAMS_PER_UNIT = 500;
const FLAT_DELIVERY_KOPECKS = 29_900;
export const MAX_ATTEMPTS_PER_CUSTOMER = 3;

export interface OrderQuote {
  subtotalKopecks: number;
  discountKopecks: number;
  deliveryKopecks: number;
  totalKopecks: number;
  promoApplied: boolean;
  deliveryEstimated: boolean;
}

export async function quoteOrder(
  items: OrderItem[],
  options: { city: string; promoCode?: string },
): Promise<OrderQuote> {
  const subtotalKopecks = orderTotal(items);
  const promo = applyPromo(options.promoCode, subtotalKopecks);
  if (options.promoCode && !promo.applied) {
    logger.warn(`promo code ${options.promoCode} was not applied`);
  }
  const weightGrams = items.reduce((sum, item) => sum + item.quantity * GRAMS_PER_UNIT, 0);
  let deliveryKopecks: number;
  let deliveryEstimated = false;
  try {
    deliveryKopecks = (await delivery.quote(options.city, weightGrams)).priceKopecks;
  } catch (err) {
    if (!(err instanceof DeliveryUnavailableError)) throw err;
    logger.warn(`delivery quote is unavailable for ${options.city}, flat rate is used`);
    deliveryKopecks = FLAT_DELIVERY_KOPECKS;
    deliveryEstimated = true;
  }
  return {
    subtotalKopecks,
    discountKopecks: promo.discountKopecks,
    deliveryKopecks,
    totalKopecks: subtotalKopecks - promo.discountKopecks + deliveryKopecks,
    promoApplied: promo.applied,
    deliveryEstimated,
  };
}

// Попытки оформления на покупателя: после третьей оформление блокируется.
const attempts = new Map<string, number>();

export function registerAttempt(customerId: string): { allowed: boolean; remaining: number } {
  const used = (attempts.get(customerId) ?? 0) + 1;
  attempts.set(customerId, used);
  return {
    allowed: used <= MAX_ATTEMPTS_PER_CUSTOMER,
    remaining: Math.max(0, MAX_ATTEMPTS_PER_CUSTOMER - used),
  };
}
