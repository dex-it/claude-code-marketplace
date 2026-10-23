import { describe, expect, it, vi } from 'vitest';
import { delivery } from '../src/clients/delivery.js';
import { quoteOrder, registerAttempt } from '../src/services/checkout.js';

vi.mock('../src/services/promo.js', () => ({
  applyPromo: vi.fn(() => ({ applied: true, discountKopecks: 10_000 })),
}));
vi.mock('../src/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../src/clients/delivery.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/clients/delivery.js')>();
  return { ...actual, delivery: { quote: vi.fn().mockResolvedValue({ priceKopecks: 25_000, days: 2 }) } };
});

const items = [{ productId: 'p1', title: 'Кружка', quantity: 2, priceKopecks: 60_000 }];

describe('quoteOrder', () => {
  it('считает доставку', async () => {
    await quoteOrder(items, { city: 'Казань', promoCode: 'WELCOME10' });
    expect(delivery.quote).toHaveBeenCalledWith('Казань', 1000);
  });

  it('промокод применён', async () => {
    const q = await quoteOrder(items, { city: 'Казань', promoCode: 'WELCOME10' });
    expect(q.promoApplied).toBe(true);
    expect(delivery.quote).toHaveBeenCalledTimes(2);
  });
});

describe('registerAttempt', () => {
  it('первая попытка', () => {
    expect(registerAttempt('c1').remaining).toBe(2);
  });
  it('вторая попытка', () => {
    expect(registerAttempt('c1').remaining).toBe(1);
  });
});
