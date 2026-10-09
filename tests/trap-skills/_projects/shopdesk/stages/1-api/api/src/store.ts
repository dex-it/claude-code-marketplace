import { randomUUID } from 'node:crypto';
import { OrderStatus, orderTotal, type Order, type OrderItem } from './domain/order.js';
import type { Product } from './domain/product.js';
import type { User } from './domain/user.js';

export class Store {
  readonly users = new Map<string, User>();
  readonly products = new Map<string, Product>();
  readonly orders = new Map<string, Order>();
  private nextOrderNumber = 1001;

  findUserByEmail(email: string): User | undefined {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) return user;
    }
    return undefined;
  }

  listProducts(): Product[] {
    return [...this.products.values()];
  }

  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  listOrdersByCustomer(customerId: string): Order[] {
    return [...this.orders.values()]
      .filter((order) => order.customerId === customerId)
      .sort((a, b) => b.number - a.number);
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  saveOrder(order: Order): Order {
    this.orders.set(order.id, order);
    if (order.number >= this.nextOrderNumber) this.nextOrderNumber = order.number + 1;
    return order;
  }

  createOrder(customerId: string, items: OrderItem[], now = new Date()): Order {
    return this.saveOrder({
      id: randomUUID(),
      number: this.nextOrderNumber,
      customerId,
      items,
      totalKopecks: orderTotal(items),
      status: OrderStatus.New,
      createdAt: now.toISOString(),
    });
  }
}
