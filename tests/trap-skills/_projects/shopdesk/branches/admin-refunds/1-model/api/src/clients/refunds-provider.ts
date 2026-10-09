const REFUNDS_URL = process.env.REFUNDS_URL;
const REFUNDS_API_KEY = process.env.REFUNDS_API_KEY ?? '';

export interface ProviderRefundRequest {
  orderId: string;
  amountKopecks?: number;
  reason: string;
}

interface ProviderRefundResponse {
  refund_id: string;
  status: 'accepted';
}

export const refundsProvider = {
  async refund(req: ProviderRefundRequest): Promise<{ providerRefundId: string }> {
    const res = await fetch(new URL('/v1/refunds', REFUNDS_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': REFUNDS_API_KEY },
      body: JSON.stringify({ order_id: req.orderId, amount: req.amountKopecks, reason: req.reason }),
    });
    const body = (await res.json()) as ProviderRefundResponse;
    return { providerRefundId: body.refund_id };
  },
};
