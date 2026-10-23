import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryUnavailableError, delivery } from '../src/clients/delivery.js';
import type { OrderItem } from '../src/domain/order.js';
import { logger } from '../src/logger.js';
import { MAX_ATTEMPTS_PER_CUSTOMER, quoteOrder, registerAttempt } from '../src/services/checkout.js';

const items: OrderItem[] = [
  { productId: 'p1', title: 'Кружка', quantity: 2, priceKopecks: 60_000 },
  { productId: 'p2', title: 'Блюдце', quantity: 1, priceKopecks: 30_000 },
]; // 150 000 копеек

describe('quoteOrder', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.restoreAllMocks();
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(delivery, 'quote').mockResolvedValue({ priceKopecks: 25_000, days: 2 });
  });

  it('сумма позиций плюс доставка', async () => {
    const q = await quoteOrder(items, { city: 'Казань' });
    expect(q).toEqual({
      subtotalKopecks: 150_000, discountKopecks: 0, deliveryKopecks: 25_000, totalKopecks: 175_000,
      promoApplied: false, deliveryEstimated: false,
    });
    expect(delivery.quote).toHaveBeenCalledWith('Казань', 1500);
  });

  it('WELCOME10 вычитает 10% от суммы позиций', async () => {
    const q = await quoteOrder(items, { city: 'Казань', promoCode: 'welcome10' });
    expect(q.discountKopecks).toBe(15_000);
    expect(q.totalKopecks).toBe(150_000 - 15_000 + 25_000);
    expect(q.promoApplied).toBe(true);
  });

  it('неизвестный промокод и малая сумма - без скидки и с предупреждением', async () => {
    const a = await quoteOrder(items, { city: 'Казань', promoCode: 'NOPE' });
    expect(a.discountKopecks).toBe(0);
    expect(a.promoApplied).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const small = await quoteOrder([{ ...items[1], quantity: 1 }], { city: 'Казань', promoCode: 'WELCOME10' });
    expect(small.discountKopecks).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('граница порога WELCOME10', async () => {
    const at = await quoteOrder([{ ...items[0], quantity: 1, priceKopecks: 100_000 }], { city: 'К', promoCode: 'WELCOME10' });
    expect(at.discountKopecks).toBe(10_000);
    const below = await quoteOrder([{ ...items[0], quantity: 1, priceKopecks: 99_999 }], { city: 'К', promoCode: 'WELCOME10' });
    expect(below.discountKopecks).toBe(0);
  });

  it('склад доставки недоступен - фиксированный тариф и оценка', async () => {
    vi.mocked(delivery.quote).mockRejectedValue(new DeliveryUnavailableError('down'));
    const q = await quoteOrder(items, { city: 'Казань' });
    expect(q.deliveryKopecks).toBe(29_900);
    expect(q.totalKopecks).toBe(179_900);
    expect(q.deliveryEstimated).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('прочая ошибка доставки уходит наружу', async () => {
    const err = new Error('delivery responded with 400');
    vi.mocked(delivery.quote).mockRejectedValue(err);
    await expect(quoteOrder(items, { city: 'Казань' })).rejects.toBe(err);
  });
});

describe('registerAttempt', () => {
  it('после третьей попытки отказ', () => {
    const id = 'cust-limit';
    expect(registerAttempt(id)).toEqual({ allowed: true, remaining: 2 });
    expect(registerAttempt(id)).toEqual({ allowed: true, remaining: 1 });
    expect(registerAttempt(id)).toEqual({ allowed: true, remaining: 0 });
    expect(registerAttempt(id)).toEqual({ allowed: false, remaining: 0 });
    expect(MAX_ATTEMPTS_PER_CUSTOMER).toBe(3);
  });

  it('покупатели независимы', () => {
    for (let i = 0; i < 4; i += 1) registerAttempt('cust-a');
    expect(registerAttempt('cust-b')).toEqual({ allowed: true, remaining: 2 });
  });
});
