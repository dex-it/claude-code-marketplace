import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice } from '../src/money.js'
import { invoiceLine } from '../src/invoice.js'
import { cartTotal } from '../src/cart.js'

const bad = (s) => (e) => e instanceof RangeError && e.message.includes(s)
const tea = { name: 'Чай', cents: 1250 }
test('R1 currency', () => assert.equal(invoiceLine(tea, 'EUR'), 'Чай: 12.50 EUR'))
test('R2 default USD', () => assert.equal(invoiceLine(tea), 'Чай: 12.50 USD'))
test('R3 lowercase', () => assert.throws(() => invoiceLine(tea, 'eur'), bad('eur')))
test('R3 length', () => assert.throws(() => invoiceLine(tea, 'EURO'), bad('EURO')))
test('regression invoice amount check', () => assert.throws(() => invoiceLine({ name: 'x', cents: -1 }, 'EUR'), RangeError))
test('regression invoice fraction cents', () => assert.throws(() => invoiceLine({ name: 'x', cents: 1.5 }, 'EUR'), RangeError))
test('regression formatPrice', () => assert.equal(formatPrice(1250), '12.50 USD'))
test('regression cart', () => assert.equal(cartTotal([{ cents: 100 }, { cents: 250 }]), 'Итого: 3.50 USD'))
