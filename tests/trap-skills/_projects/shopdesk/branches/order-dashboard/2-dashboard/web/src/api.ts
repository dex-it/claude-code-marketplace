import type { CurrentUser, DeliveryAddress, Order, Product } from './types';

const TOKEN_KEY = 'shopdesk.token';
const ROLE_KEY = 'shopdesk.role';

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

export function getRole(): CurrentUser['role'] | null {
  const role = localStorage.getItem(ROLE_KEY);
  return role === 'admin' || role === 'customer' ? role : null;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  localStorage.setItem(ROLE_KEY, result.user.role);
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

export function getAdminOrders(): Promise<Order[]> {
  return request<Order[]>('/api/admin/orders');
}

export function saveDelivery(orderId: string, delivery: DeliveryAddress): Promise<Order> {
  return request<Order>(`/api/admin/orders/${encodeURIComponent(orderId)}/delivery`, {
    method: 'PUT',
    body: JSON.stringify(delivery),
  });
}
