import { applyDiscount } from './discount.js'

export function invoiceTotal(customer, items) {
  const priced = customer.vip ? applyDiscount(items, 0.1) : items
  return priced.reduce((sum, it) => sum + it.price * it.qty, 0)
}
