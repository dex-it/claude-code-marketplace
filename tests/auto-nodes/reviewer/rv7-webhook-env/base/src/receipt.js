import { formatAmount } from './money.js'

export function renderReceipt(order) {
  return `Заказ ${order.id}: ${formatAmount(order.totalCents)} руб.`
}
