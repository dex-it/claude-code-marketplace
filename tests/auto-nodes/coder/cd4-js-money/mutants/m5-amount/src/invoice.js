import { formatPrice } from './money.js'

export function invoiceLine(item, currency = 'USD') {
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError(`bad currency: ${currency}`)
  return `${item.name}: ${(item.cents / 100).toFixed(2)} ${currency}`
}
