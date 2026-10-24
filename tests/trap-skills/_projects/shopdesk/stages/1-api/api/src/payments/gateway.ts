export interface ChargeRequest {
  orderId: string;
  amountKopecks: number;
  currency: 'RUB';
}

export type ChargeResult =
  | { status: 'approved'; transactionId: string }
  | { status: 'declined'; reason: string };

export interface PaymentGateway {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}
