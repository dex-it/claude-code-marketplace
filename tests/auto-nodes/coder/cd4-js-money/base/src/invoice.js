import { formatPrice } from './money.js'

export function invoiceLine(item) {
  return `${item.name}: ${formatPrice(item.cents)}`
}
