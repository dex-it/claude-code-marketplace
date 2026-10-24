import { describe, expect, it } from 'vitest';
import type { Order } from '../../types';
import { filterOrders, sortByDate, summarize } from '../dashboard';

function order(number: number, patch: Partial<Order> = {}): Order {
  return {
    id: `ord-${number}`,
    number,
    customerId: 'u-alice',
    items: [],
    totalKopecks: 100000,
    discountKopecks: 0,
    status: 'new',
    createdAt: '2026-09-10T10:00:00.000Z',
    ...patch,
  };
}

describe('dashboard helpers', () => {
  const orders = [
    order(1, { createdAt: '2026-09-01T09:00:00.000Z', status: 'paid' }),
    order(2, { createdAt: '2026-09-05T15:30:00.000Z' }),
    order(3, { createdAt: '2026-09-12T11:00:00.000Z', status: 'cancelled' }),
  ];

  it('filters by status', () => {
    expect(filterOrders(orders, { status: 'paid', from: '', to: '' }).map((o) => o.number)).toEqual([1]);
  });

  it('filters by period', () => {
    const result = filterOrders(orders, { status: 'all', from: '2026-09-02', to: '2026-09-10' });
    expect(result.map((o) => o.number)).toEqual([2]);
  });

  it('sorts newest first', () => {
    expect(sortByDate([...orders]).map((o) => o.number)).toEqual([3, 2, 1]);
  });

  it('summarizes revenue without cancelled orders', () => {
    const stats = summarize([...orders, order(4, { totalKopecks: 50000, discountKopecks: 5000 })]);
    expect(stats).toMatchObject({ count: 4, revenueKopecks: 250000, discountKopecks: 5000 });
    expect(stats.byStatus).toEqual({ new: 2, paid: 1, cancelled: 1 });
  });
});
