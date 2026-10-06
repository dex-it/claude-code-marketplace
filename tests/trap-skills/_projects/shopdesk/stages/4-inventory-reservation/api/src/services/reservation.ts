import { inventory, TemporaryInventoryError } from '../clients/inventory.js';
import type { OrderItem } from '../domain/order.js';
import { logger } from '../logger.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2000];
const HOLD_MS = 15 * 60 * 1000;

export class ReservationFailedError extends Error {
  constructor(
    readonly orderId: string,
    readonly attempts: number,
  ) {
    super(`Reservation for order ${orderId} failed after ${attempts} attempts`);
    this.name = 'ReservationFailedError';
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reserveWithRetry(
  orderId: string,
  items: OrderItem[],
): Promise<{ reservationId: string; attempts: number }> {
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const { reservationId } = await inventory.reserve(orderId, items);
      return { reservationId, attempts };
    } catch (err) {
      if (!(err instanceof TemporaryInventoryError)) throw err;
      logger.warn(`inventory is unavailable for order ${orderId} (attempt ${attempts} of ${MAX_ATTEMPTS})`);
      if (attempts < MAX_ATTEMPTS) await pause(RETRY_DELAYS_MS[attempts - 1]);
    }
  }
  throw new ReservationFailedError(orderId, attempts);
}

export function holdUntil(now: number): number {
  return now + HOLD_MS;
}

export function isHoldExpired(holdUntilMs: number, now = Date.now()): boolean {
  return now > holdUntilMs;
}
