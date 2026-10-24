import { DomainError } from './errors.js'
import { CURRENCIES } from './currencies.js'

// Сумма в минорных единицах -> строка вида '12.50 USD'.
export function formatPrice(cents, currency = 'USD') {
  if (!Number.isInteger(cents) || cents < 0) throw new DomainError('BAD_AMOUNT', cents)
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) throw new DomainError('BAD_CURRENCY', currency)
  const c = CURRENCIES[currency]
  if (!c) throw new DomainError('UNSUPPORTED_CURRENCY', currency)
  return `${(cents / 100).toFixed(2)} ${currency}`
}
