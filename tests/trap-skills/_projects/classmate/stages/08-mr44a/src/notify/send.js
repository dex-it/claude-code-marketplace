import { enqueue } from '../queue/index.js';
import { bookingSubject, bookingLine } from './format.js';

export function sendBookingEmail(booking, tutor, student) {
  enqueue('notifications', {
    channel: 'email',
    to: student.email,
    subject: bookingSubject(booking),
    body: bookingLine(booking, tutor),
  });
}
