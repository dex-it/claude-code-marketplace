// Сумма в центах -> строка вида '12.50 USD'.
export function formatPrice(cents) {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError(`bad amount: ${cents}`)
  return `${(cents / 100).toFixed(2)} USD`
}
