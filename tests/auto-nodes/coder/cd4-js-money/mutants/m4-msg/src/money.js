// Сумма в центах -> строка вида '12.50 USD'.
export function formatPrice(cents, currency = 'USD') {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError(`bad amount: ${cents}`)
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError(`bad currency`)
  return `${(cents / 100).toFixed(2)} ${currency}`
}
