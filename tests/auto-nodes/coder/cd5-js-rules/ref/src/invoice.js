import { formatPrice } from './money.js'

export function invoiceLine(item, currency) {
  return `${item.name}: ${formatPrice(item.cents, currency)}`
}
