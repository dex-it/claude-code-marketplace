export function createStore(initial = []) {
  const orders = new Map();
  for (const order of initial) orders.set(String(order.id), order);
  return {
    get(id) {
      return orders.get(String(id));
    },
    put(order) {
      orders.set(String(order.id), order);
      return order;
    },
    all() {
      return [...orders.values()];
    },
  };
}
