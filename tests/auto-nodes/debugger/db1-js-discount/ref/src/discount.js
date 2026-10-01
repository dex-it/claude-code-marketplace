export function applyDiscount(items, rate) {
  return items.map(it => ({ ...it, price: it.price * (1 - rate) }))
}
