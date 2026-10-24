export function rescheduleRequest(booking, newStart) {
  return {
    bookingId: booking.id,
    from: new Date(booking.start).toLocaleString('ru-RU'),
    to: new Date(newStart).toLocaleString('ru-RU'),
  };
}
