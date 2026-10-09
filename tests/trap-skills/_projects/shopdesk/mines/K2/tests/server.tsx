import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { OrdersPage } from '../../components/OrdersPage';

export interface FakeOrder {
  id: string;
  number: number;
  customerId: string;
  items: { productId: string; title: string; quantity: number; priceKopecks: number }[];
  totalKopecks: number;
  discountKopecks: number;
  status: 'new' | 'paid' | 'cancelled';
  createdAt: string;
}

export function order(number: number, title: string): FakeOrder {
  return {
    id: `ord-${number}`,
    number,
    customerId: 'u-alice',
    items: [{ productId: `p-${number}`, title, quantity: 1, priceKopecks: 100000 }],
    totalKopecks: 100000,
    discountKopecks: 0,
    status: 'paid',
    createdAt: '2026-09-01T10:00:00.000Z',
  };
}

export const ALL = [order(1001, 'Кружка керамическая'), order(1002, 'Чай улун, 100 г')];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

interface Pending {
  q: string;
  respond: (orders: FakeOrder[]) => void;
}

// Поддельный сервер: запрос без q отвечает сразу полным списком; запросы с q либо отвечают сразу
// (auto), либо ждут ручного ответа (manual). Сигнал отмены уважается, как у настоящего fetch.
export function fakeServer(mode: { auto?: (q: string) => FakeOrder[] }) {
  const searches: string[] = [];
  const pending: Pending[] = [];
  const fetchMock = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, 'http://localhost');
    if (!url.pathname.startsWith('/api/orders')) return Promise.resolve(json([]));
    const q = url.searchParams.get('q') ?? '';
    if (q === '') return Promise.resolve(json(ALL));
    searches.push(q);
    if (mode.auto) return Promise.resolve(json(mode.auto(q)));
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    return new Promise<Response>((resolve, reject) => {
      const abortError = () => new DOMException('The operation was aborted.', 'AbortError');
      if (signal?.aborted) return reject(abortError());
      signal?.addEventListener('abort', () => reject(abortError()));
      pending.push({ q, respond: (orders) => resolve(json(orders)) });
    });
  };
  vi.stubGlobal('fetch', fetchMock);
  return {
    searches,
    respond(q: string, orders: FakeOrder[]) {
      const index = pending.findIndex((p) => p.q === q);
      if (index === -1) throw new Error(`no pending request for q=${q}; requests: ${JSON.stringify(searches)}`);
      const [item] = pending.splice(index, 1);
      item!.respond(orders);
    },
    respondAll(orders: FakeOrder[]) {
      for (const item of pending.splice(0)) item.respond(orders);
    },
  };
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  localStorage.setItem('shopdesk.token', 'mine-token');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

export async function renderPage() {
  const view = render(<OrdersPage />);
  await screen.findByText('Заказ #1001', undefined, { timeout: 3000 });
  const input =
    screen.queryByLabelText(/Поиск заказов/i) ??
    screen.queryByPlaceholderText(/Поиск заказов/i) ??
    screen.getByRole('searchbox');
  return { view, input };
}
