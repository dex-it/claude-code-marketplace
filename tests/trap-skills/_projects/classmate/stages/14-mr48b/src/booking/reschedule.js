import { toUtcIso } from '../util/time.js';

export function rescheduleRequest(booking, newStart) {
  return {
    bookingId: booking.id,
    from: toUtcIso(booking.start),
    to: toUtcIso(newStart),
  };
}
