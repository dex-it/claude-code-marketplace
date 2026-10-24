import { readFileSync } from 'node:fs';
import * as refund from '../billing/refund.js';

const partners = JSON.parse(readFileSync(new URL('../../config/partners.json', import.meta.url), 'utf8'));

export function refundForSchool(schoolId, booking, cancelledAt) {
  const cfg = partners[schoolId];
  const fn = cfg ? refund[cfg.refundFn] : refund.refundFor;
  return fn(booking, cancelledAt);
}
