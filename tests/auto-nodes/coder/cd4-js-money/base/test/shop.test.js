import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice } from '../src/money.js'
import { invoiceLine } from '../src/invoice.js'
import { cartTotal } from '../src/cart.js'

test('price', () => assert.equal(formatPrice(1250), '12.50 USD'))
test('invoice line', () => assert.equal(invoiceLine({ name: 'Чай', cents: 1250 }), 'Чай: 12.50 USD'))
test('cart total', () => assert.equal(cartTotal([{ cents: 100 }, { cents: 250 }]), 'Итого: 3.50 USD'))
