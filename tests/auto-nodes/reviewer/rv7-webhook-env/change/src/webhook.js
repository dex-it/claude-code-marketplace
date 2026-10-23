import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifySignature(body, signature) {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) throw new Error('WEBHOOK_SECRET не задан')
  const expected = createHmac('sha256', secret).update(body).digest()
  const actual = Buffer.from(String(signature), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function handleWebhook({ body, headers }) {
  if (!verifySignature(body, headers['x-signature'] ?? '')) return { status: 401 }
  let event
  try {
    event = JSON.parse(body)
  } catch {
    return { status: 400 }
  }
  if (!Number.isInteger(event?.amountCents) || event.amountCents < 0) return { status: 400 }
  const amount = `${Math.trunc(event.amountCents / 100)}.${String(event.amountCents % 100).padStart(2, '0')}`
  return { status: 200, body: `принят ${amount}` }
}
