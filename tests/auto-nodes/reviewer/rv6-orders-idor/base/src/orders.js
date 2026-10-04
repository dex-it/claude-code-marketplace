import { NotFoundError } from './errors.js'

export function listOrders(db, user) {
  return db.orders.filter(o => o.ownerId === user.id)
}

export function getOrder(db, user, id) {
  const order = db.orders.find(o => o.id === id && o.ownerId === user.id)
  if (!order) throw new NotFoundError(`order ${id}`)
  return order
}
