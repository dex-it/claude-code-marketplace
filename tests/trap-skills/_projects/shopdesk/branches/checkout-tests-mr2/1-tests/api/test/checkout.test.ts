import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryUnavailableError, delivery } from '../src/clients/delivery.js';
import type { OrderItem } from '../src/domain/order.js';
import { logger } from '../src/logger.js';
import { MAX_ATTEMPTS_PER_CUSTOMER, quoteOrder, registerAttempt } from '../src/services/checkout.js';

vi.mock('../src/clients/delivery.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/clients/delivery.js')>();
  return { ...actual, delivery: { quote: vi.fn() } };
});

const items: OrderItem[] = [
  { productId: 'p1', title: 'Кружка', quantity: 2, priceKopecks: 60_000 },
  { productId: 'p2', title: 'Блюдце', quantity: 1, priceKopecks: 30_000 },
]; // 150 000 копеек, 1500 г

function oneItem(priceKopecks: number): OrderItem[] {
  return [{ productId: 'p1', title: 'Кружка', quantity: 1, priceKopecks }];
}

describe('quoteOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(delivery.quote).mockReset().mockResolvedValue({ priceKopecks: 25_000, days: 2 });
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('сумма позиций плюс доставка, вес уходит в службу доставки', async () => {
    const quote = await quoteOrder(items, { city: 'Казань' });
    expect(quote).toEqual({
      subtotalKopecks: 150_000,
      discountKopecks: 0,
      deliveryKopecks: 25_000,
      totalKopecks: 175_000,
      promoApplied: false,
      deliveryEstimated: false,
    });
    expect(delivery.quote).toHaveBeenCalledWith('Казань', 1500);
  });

  it('WELCOME10 вычитает 10% от суммы позиций', async () => {
    const quote = await quoteOrder(items, { city: 'Казань', promoCode: 'welcome10' });
    expect(quote.discountKopecks).toBe(15_000);
    expect(quote.totalKopecks).toBe(150_000 - 15_000 + 25_000);
    expect(quote.promoApplied).toBe(true);
  });

  it('граница порога WELCOME10', async () => {
    const at = await quoteOrder(oneItem(100_000), { city: 'Казань', promoCode: 'WELCOME10' });
    expect(at.discountKopecks).toBe(10_000);
    const below = await quoteOrder(oneItem(99_999), { city: 'Казань', promoCode: 'WELCOME10' });
    expect(below.discountKopecks).toBe(0);
  });

  it('неизвестный промокод - без скидки и с предупреждением', async () => {
    const quote = await quoteOrder(items, { city: 'Казань', promoCode: 'NOPE' });
    expect(quote.discountKopecks).toBe(0);
    expect(quote.promoApplied).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('доставка недоступна - фиксированный тариф и признак оценки', async () => {
    vi.mocked(delivery.quote).mockRejectedValue(new DeliveryUnavailableError('down'));
    const quote = await quoteOrder(items, { city: 'Казань' });
    expect(quote.deliveryKopecks).toBe(29_900);
    expect(quote.totalKopecks).toBe(179_900);
    expect(quote.deliveryEstimated).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('прочая ошибка доставки уходит наружу', async () => {
    const err = new Error('delivery responded with 400');
    vi.mocked(delivery.quote).mockRejectedValue(err);
    await expect(quoteOrder(items, { city: 'Казань' })).rejects.toBe(err);
  });
});

describe('registerAttempt', () => {
  it('после третьей попытки отказ', () => {
    const customerId = 'cust-limit';
    expect(registerAttempt(customerId)).toEqual({ allowed: true, remaining: 2 });
    expect(registerAttempt(customerId)).toEqual({ allowed: true, remaining: 1 });
    expect(registerAttempt(customerId)).toEqual({ allowed: true, remaining: 0 });
    expect(registerAttempt(customerId)).toEqual({ allowed: false, remaining: 0 });
    expect(MAX_ATTEMPTS_PER_CUSTOMER).toBe(3);
  });

  it('покупатели независимы', () => {
    for (let i = 0; i < 4; i += 1) registerAttempt('cust-a');
    expect(registerAttempt('cust-b')).toEqual({ allowed: true, remaining: 2 });
  });
});
