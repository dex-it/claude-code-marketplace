export enum RefundStatus {
  Pending = 'pending',
  Completed = 'completed',
  Rejected = 'rejected',
  Failed = 'failed',
}

export interface Refund {
  id: string;
  orderId: string;
  items: string[];
  amountKopecks: number;
  reason: string;
  status: RefundStatus;
  providerRefundId?: string;
  orderBalanceKopecks?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
