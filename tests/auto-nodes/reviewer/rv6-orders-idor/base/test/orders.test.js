import test from 'node:test'
import assert from 'node:assert/strict'
import { listOrders, getOrder } from '../src/orders.js'
import { NotFoundError } from '../src/errors.js'

const db = () => ({ orders: [{ id: 1, ownerId: 'a', status: 'new' }, { id: 2, ownerId: 'b', status: 'new' }] })

test('listOrders - только свои', () => {
  assert.deepEqual(listOrders(db(), { id: 'a' }).map(o => o.id), [1])
})

test('getOrder - чужой не найден', () => {
  assert.throws(() => getOrder(db(), { id: 'a' }, 2), NotFoundError)
})
