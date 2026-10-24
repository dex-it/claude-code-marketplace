import { sendMail } from '../smtp/client.js';
import { bookingSubject, bookingLine } from './format.js';

export async function sendBookingEmail(booking, tutor, student) {
  await sendMail({
    to: student.email,
    subject: bookingSubject(booking),
    body: bookingLine(booking, tutor),
  });
}
