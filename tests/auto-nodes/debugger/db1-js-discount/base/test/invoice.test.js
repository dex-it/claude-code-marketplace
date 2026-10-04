import { test } from 'node:test'
import assert from 'node:assert/strict'
import { invoiceTotal } from '../src/invoice.js'

test('обычный клиент платит полную сумму', () => {
  assert.equal(invoiceTotal({ vip: false }, [{ price: 50, qty: 2 }]), 100)
})

test('VIP получает 10%', () => {
  assert.equal(invoiceTotal({ vip: true }, [{ price: 50, qty: 2 }]), 90)
})
