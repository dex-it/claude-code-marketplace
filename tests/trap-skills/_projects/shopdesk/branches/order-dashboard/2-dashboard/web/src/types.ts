export type OrderStatus = 'new' | 'paid' | 'cancelled';

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  priceKopecks: number;
}

export interface DeliveryRecipient {
  name: string;
  phone: string;
}

export interface DeliveryAddress {
  city: string;
  street: string;
  recipients: DeliveryRecipient[];
}

export interface Order {
  id: string;
  number: number;
  customerId: string;
  items: OrderItem[];
  totalKopecks: number;
  discountKopecks: number;
  status: OrderStatus;
  createdAt: string;
  delivery?: DeliveryAddress;
}

export interface Product {
  id: string;
  title: string;
  priceKopecks: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}
