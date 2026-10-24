const sent = [];
const token = process.env.SMTP_TOKEN;

export async function sendMail(message) {
  if (!token) return { ok: false, code: 'smtp_not_configured' };
  sent.push({ ...message, sentAt: new Date().toISOString() });
  return { ok: true };
}

export function sentMessages() {
  return sent;
}
