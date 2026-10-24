const sent = [];

export async function sendMail(message) {
  sent.push({ ...message, sentAt: new Date().toISOString() });
}

export function sentMessages() {
  return sent;
}
