import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice } from '../src/money.js'
import { invoiceLine } from '../src/invoice.js'
import { cartTotal } from '../src/cart.js'
import { DomainError } from '../src/errors.js'

const tea = { name: 'Чай', cents: 1250 }
const has = (s) => (e) => e.message.includes(s)
test('R1 currency', () => assert.equal(invoiceLine(tea, 'EUR'), 'Чай: 12.50 EUR'))
test('R2 default USD', () => assert.equal(invoiceLine(tea), 'Чай: 12.50 USD'))
test('R3 lowercase', () => assert.throws(() => invoiceLine(tea, 'eur'), has('eur')))
test('R3 length', () => assert.throws(() => invoiceLine(tea, 'EURO'), has('EURO')))
test('CLAUDE.md DomainError', () => assert.throws(() => invoiceLine(tea, 'eur'), (e) => e instanceof DomainError && typeof e.code === 'string'))
test('ADR-0001 unsupported', () => assert.throws(() => invoiceLine(tea, 'GBP'), (e) => e instanceof DomainError && e.code === 'UNSUPPORTED_CURRENCY' && e.message.includes('GBP')))
test('BR-002 JPY', () => assert.equal(invoiceLine(tea, 'JPY'), 'Чай: 1250 JPY'))
test('regression amount', () => assert.throws(() => invoiceLine({ name: 'x', cents: -1 }, 'EUR'), { code: 'BAD_AMOUNT' }))
test('regression formatPrice', () => assert.equal(formatPrice(1250), '12.50 USD'))
test('regression cart', () => assert.equal(cartTotal([{ cents: 100 }, { cents: 250 }]), 'Итого: 3.50 USD'))
