import type { CurrentUser, Order, Product } from './types';

const TOKEN_KEY = 'shopdesk.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      payload?.error?.code ?? 'http_error',
      payload?.error?.message ?? `Request failed with status ${res.status}`,
    );
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const result = await request<{ token: string; user: CurrentUser }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(result.token);
  return result.user;
}

export function getProducts(): Promise<Product[]> {
  return request<Product[]>('/api/products');
}

export function getOrders(q?: string): Promise<Order[]> {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  return request<Order[]>(`/api/orders${query}`);
}

export function cancelOrder(id: string): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}
