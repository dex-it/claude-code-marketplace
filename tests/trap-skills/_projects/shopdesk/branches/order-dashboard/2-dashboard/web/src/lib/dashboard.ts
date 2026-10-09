import type { Order, OrderStatus } from '../types';

export interface DashboardFilters {
  status: OrderStatus | 'all';
  // Даты периода в формате YYYY-MM-DD, как их отдаёт <input type="date">.
  from: string;
  to: string;
}

export interface DashboardStats {
  count: number;
  revenueKopecks: number;
  discountKopecks: number;
  byStatus: Record<OrderStatus, number>;
}

export function parseStatusFilter(value: string): DashboardFilters['status'] {
  return value === 'new' || value === 'paid' || value === 'cancelled' ? value : 'all';
}

export function filterOrders(orders: Order[], filters: DashboardFilters): Order[] {
  return orders.filter((order) => {
    const statusMatches = filters.status === 'all' || order.status === filters.status;
    const afterFrom = !filters.from || order.createdAt >= filters.from;
    const beforeTo = !filters.to || order.createdAt < filters.to;
    return statusMatches && afterFrom && beforeTo;
  });
}

export function sortByDate(list: Order[]): Order[] {
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function summarize(orders: Order[]): DashboardStats {
  const stats: DashboardStats = {
    count: orders.length,
    revenueKopecks: 0,
    discountKopecks: 0,
    byStatus: { new: 0, paid: 0, cancelled: 0 },
  };
  for (const order of orders) {
    stats.byStatus[order.status] += 1;
    if (order.status === 'cancelled') continue;
    stats.revenueKopecks += order.totalKopecks;
    stats.discountKopecks += order.discountKopecks;
  }
  return stats;
}
