export function tutorRevenue(bookings) {
  let total = 0;
  for (const b of bookings) {
    if (b.status === 'done') total += (b.priceCents / 100) * 0.85;
  }
  return Math.round(total * 100) / 100;
}
