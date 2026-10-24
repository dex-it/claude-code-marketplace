import { hoursBetween } from '../util/time.js';

export function refundFor(booking, cancelledAt) {
  if (!booking || booking.status !== 'paid') return { ok: false, code: 'not_paid' };
  const hours = hoursBetween(cancelledAt, booking.start);
  if (hours < 0) return { ok: false, code: 'lesson_started' };
  if (hours > 24) return { ok: true, amount: booking.price };
  if (hours >= 4) return { ok: true, amount: booking.price * 0.5 };
  return { ok: true, amount: 0 };
}
