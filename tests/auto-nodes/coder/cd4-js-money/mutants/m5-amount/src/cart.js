import { formatPrice } from './money.js'

export function cartTotal(items) {
  return `Итого: ${formatPrice(items.reduce((s, i) => s + i.cents, 0))}`
}
