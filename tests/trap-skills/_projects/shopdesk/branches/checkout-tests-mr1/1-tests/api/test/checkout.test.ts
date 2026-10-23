import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryUnavailableError, delivery } from '../src/clients/delivery.js';
import type { OrderItem } from '../src/domain/order.js';
import { logger } from '../src/logger.js';
import { MAX_ATTEMPTS_PER_CUSTOMER, quoteOrder, registerAttempt } from '../src/services/checkout.js';
import { applyPromo } from '../src/services/promo.js';

vi.mock('../src/services/promo.js', () => ({
  applyPromo: vi.fn(() => ({ applied: true, discountKopecks: 10_000 })),
}));
vi.mock('../src/clients/delivery.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/clients/delivery.js')>();
  return { ...actual, delivery: { quote: vi.fn() } };
});

const items: OrderItem[] = [{ productId: 'p1', title: 'Кружка', quantity: 2, priceKopecks: 60_000 }];
const customerId = 'cust-1';

describe('quoteOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(delivery.quote).mockReset().mockResolvedValue({ priceKopecks: 25_000, days: 2 });
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('запрашивает доставку по весу заказа', async () => {
    await quoteOrder(items, { city: 'Казань' });
    expect(delivery.quote).toHaveBeenCalledWith('Казань', 1000);
    expect(delivery.quote).toHaveBeenCalledTimes(1);
  });

  it('несколько позиций увеличивают вес', async () => {
    items.push({ productId: 'p2', title: 'Блюдце', quantity: 1, priceKopecks: 30_000 });
    await quoteOrder(items, { city: 'Казань' });
    expect(delivery.quote).toHaveBeenCalledWith('Казань', 1500);
  });

  it('применяет промокод', async () => {
    const quote = await quoteOrder(items, { city: 'Казань', promoCode: 'WELCOME10' });
    expect(applyPromo).toHaveBeenCalled();
    expect(quote.discountKopecks).toBe(10_000);
    expect(quote.promoApplied).toBe(true);
  });

  it('доставка недоступна - расчёт идёт дальше', async () => {
    vi.mocked(delivery.quote).mockRejectedValue(new DeliveryUnavailableError('down'));
    await quoteOrder(items, { city: 'Казань' });
    expect(delivery.quote).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('прочая ошибка доставки уходит наружу', async () => {
    const err = new Error('delivery responded with 400');
    vi.mocked(delivery.quote).mockRejectedValue(err);
    await expect(quoteOrder(items, { city: 'Казань' })).rejects.toBe(err);
    expect(delivery.quote).toHaveBeenCalledWith('Казань', expect.any(Number));
  });
});

describe('registerAttempt', () => {
  it('первая попытка проходит', () => {
    expect(registerAttempt(customerId)).toEqual({ allowed: true, remaining: 2 });
  });

  it('вторая попытка проходит', () => {
    expect(registerAttempt(customerId)).toEqual({ allowed: true, remaining: 1 });
  });

  it('после третьей попытки отказ', () => {
    expect(registerAttempt(customerId)).toEqual({ allowed: true, remaining: 0 });
    expect(registerAttempt(customerId)).toEqual({ allowed: false, remaining: 0 });
    expect(MAX_ATTEMPTS_PER_CUSTOMER).toBe(3);
  });

  it('другой покупатель не затронут', () => {
    expect(registerAttempt('cust-2').allowed).toBe(true);
  });
});
