import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../../types';
import { OrdersPage } from '../OrdersPage';

const orders: Order[] = [
  {
    id: 'ord-1002',
    number: 1002,
    customerId: 'u-alice',
    items: [{ productId: 'p-tea', title: 'Чай улун, 100 г', quantity: 2, priceKopecks: 54900 }],
    totalKopecks: 109800,
    status: 'new',
    createdAt: '2026-08-30T17:40:00.000Z',
  },
  {
    id: 'ord-1003',
    number: 1003,
    customerId: 'u-alice',
    items: [{ productId: 'p-kettle', title: 'Чайник стеклянный', quantity: 1, priceKopecks: 349000 }],
    totalKopecks: 349000,
    status: 'paid',
    createdAt: '2026-08-21T08:05:00.000Z',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('OrdersPage', () => {
  beforeEach(() => {
    localStorage.setItem('shopdesk.token', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders orders of the customer', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(orders));
    vi.stubGlobal('fetch', fetchMock);

    render(<OrdersPage />);

    expect(await screen.findByText('Заказ #1002')).toBeInTheDocument();
    expect(screen.getByText('Заказ #1003')).toBeInTheDocument();
    expect(screen.getByText('Оплачен')).toBeInTheDocument();
    expect(screen.getByText(/1\s098,00\s₽/)).toBeInTheDocument();
    expect(screen.getAllByText('Отменить')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows an error when orders cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { code: 'internal', message: 'Internal error' } }, 500)));

    render(<OrdersPage />);

    expect(await screen.findByText('Не удалось загрузить заказы')).toBeInTheDocument();
  });
});
