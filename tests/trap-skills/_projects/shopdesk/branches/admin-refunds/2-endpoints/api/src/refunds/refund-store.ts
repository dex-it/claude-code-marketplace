import { randomUUID } from 'node:crypto';
import { RefundStatus, type Refund } from '../domain/refund.js';

export type NewRefund = Pick<Refund, 'orderId' | 'items' | 'amountKopecks' | 'reason' | 'createdBy'>;

// Асинхронный интерфейс - под перенос возвратов в Postgres.
export class RefundStore {
  private readonly refunds = new Map<string, Refund>();

  async create(input: NewRefund): Promise<Refund> {
    const now = new Date().toISOString();
    const refund: Refund = { ...input, id: randomUUID(), status: RefundStatus.Pending, createdAt: now, updatedAt: now };
    this.refunds.set(refund.id, refund);
    return refund;
  }

  async get(id: string): Promise<Refund | undefined> {
    return this.refunds.get(id);
  }

  async list(): Promise<Refund[]> {
    return [...this.refunds.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByOrder(orderId: string): Promise<Refund[]> {
    return [...this.refunds.values()].filter((refund) => refund.orderId === orderId);
  }

  async save(refund: Refund): Promise<Refund> {
    const saved = { ...refund, updatedAt: new Date().toISOString() };
    this.refunds.set(saved.id, saved);
    return saved;
  }
}

export const refunds = new RefundStore();
