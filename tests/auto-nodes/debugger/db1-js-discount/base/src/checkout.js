import { invoiceTotal } from './invoice.js'

export function checkout(customer, cart) {
  const preview = invoiceTotal(customer, cart.items)
  const total = invoiceTotal(customer, cart.items)
  return { preview, total }
}
