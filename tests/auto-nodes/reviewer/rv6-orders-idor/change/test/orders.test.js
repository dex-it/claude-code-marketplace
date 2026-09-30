import test from 'node:test'
import assert from 'node:assert/strict'
import { listOrders, getOrder, cancelOrder } from '../src/orders.js'
import { NotFoundError, OrderStateError } from '../src/errors.js'

const db = () => ({ orders: [{ id: 1, ownerId: 'a', status: 'new' }, { id: 2, ownerId: 'b', status: 'new' }, { id: 3, ownerId: 'a', status: 'paid' }] })

test('listOrders - только свои', () => {
  assert.deepEqual(listOrders(db(), { id: 'a' }).map(o => o.id), [1, 3])
})

test('getOrder - чужой не найден', () => {
  assert.throws(() => getOrder(db(), { id: 'a' }, 2), NotFoundError)
})

test('R1: заказ new отменяется', () => {
  assert.equal(cancelOrder(db(), { id: 'a' }, 1).status, 'cancelled')
})

test('R2: заказ не в new не отменяется', () => {
  assert.throws(() => cancelOrder(db(), { id: 'a' }, 3), OrderStateError)
})
