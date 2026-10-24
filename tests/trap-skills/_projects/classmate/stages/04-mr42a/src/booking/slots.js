import { MINUTE } from '../util/time.js';

export function freeSlots(window, bookings, durationMin, stepMin = 30) {
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  if (!(end > start)) throw new Error('bad window');
  const result = [];
  for (let t = start; t + durationMin * MINUTE < end; t += durationMin * MINUTE) {
    const slotEnd = t + durationMin * MINUTE;
    const busy = bookings.some((b) =>
      overlaps(t, slotEnd, new Date(b.start).getTime(), new Date(b.end).getTime()),
    );
    if (!busy)
      result.push({ start: new Date(t).toISOString(), end: new Date(slotEnd).toISOString(), label: f2(t) });
  }
  return result;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function f2(x) {
  let d = new Date(x);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}
