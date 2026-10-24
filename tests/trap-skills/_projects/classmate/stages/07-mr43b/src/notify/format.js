export function bookingSubject(booking) {
  if (booking.subject === null || booking.subject === undefined) return 'Урок забронирован';
  return `Урок: ${booking.subject}`;
}

export function bookingLine(booking, tutor) {
  const who = tutor.name === '' ? 'репетитор' : tutor.name;
  return `${who}, ${booking.start}`;
}
