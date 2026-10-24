import { hoursBetween } from '../util/time.js';

export function refundFor(booking, cancelledAt) {
  if (!booking || booking.status !== 'paid') return { ok: false, code: 'not_paid' };
  const hours = hoursBetween(cancelledAt, booking.start);
  if (hours < 0) return { ok: false, code: 'lesson_started' };
  if (hours > 24) return { ok: true, amountCents: booking.priceCents };
  if (hours >= 4) return { ok: true, amountCents: Math.floor(booking.priceCents / 2) };
  return { ok: true, amountCents: 0 };
}

/** @deprecated партнёрские школы по старому договору: возврат всегда полный до начала урока. */
export function refundForPartner(booking, cancelledAt) {
  if (!booking || booking.status !== 'paid') return { ok: false, code: 'not_paid' };
  if (hoursBetween(cancelledAt, booking.start) < 0) return { ok: false, code: 'lesson_started' };
  return { ok: true, amountCents: booking.priceCents };
}
