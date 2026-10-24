export function applyDiscount(items, rate) {
  for (const it of items) it.price = it.price * (1 - rate)
  return items
}
