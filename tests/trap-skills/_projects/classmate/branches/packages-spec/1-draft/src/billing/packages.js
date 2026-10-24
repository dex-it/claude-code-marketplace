import { HOUR } from '../util/time.js';

export const PACKAGE_TTL_DAYS = 90;

export function packageExpiry(purchasedAt) {
  return new Date(new Date(purchasedAt).getTime() + PACKAGE_TTL_DAYS * 24 * HOUR).toISOString();
}
