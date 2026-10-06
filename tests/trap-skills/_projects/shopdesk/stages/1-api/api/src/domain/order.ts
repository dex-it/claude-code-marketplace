export enum OrderStatus {
  New = 'new',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  priceKopecks: number;
}

export interface Order {
  id: string;
  number: number;
  customerId: string;
  items: OrderItem[];
  totalKopecks: number;
  status: OrderStatus;
  createdAt: string;
}

export function orderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.priceKopecks * item.quantity, 0);
}
