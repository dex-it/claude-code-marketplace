import test from 'node:test'
import assert from 'node:assert/strict'
import { renderReceipt } from '../src/receipt.js'

test('чек: сумма в рублях', () => {
  assert.equal(renderReceipt({ id: 'A1', totalCents: 1250 }), 'Заказ A1: 12.50 руб.')
})
