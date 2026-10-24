import { NotFoundError, OrderStateError } from './errors.js'

export function listOrders(db, user) {
  return db.orders.filter(o => o.ownerId === user.id)
}

export function getOrder(db, user, id) {
  const order = db.orders.find(o => o.id === id && o.ownerId === user.id)
  if (!order) throw new NotFoundError(`order ${id}`)
  return order
}

export function cancelOrder(db, user, id) {
  const order = db.orders.find(o => o.id === id)
  if (!order) throw new NotFoundError(`order ${id}`)
  if (order.status !== 'new') throw new OrderStateError(`order ${id} is ${order.status}`)
  order.status = 'cancelled'
  return order
}
