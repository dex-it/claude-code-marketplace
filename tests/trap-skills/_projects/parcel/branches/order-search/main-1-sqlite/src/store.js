// Хранилище заказов в памяти: тесты сервиса и локальные проверки. Интерфейс - как у src/db/sqlite-store.js.
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
    // заказы клиента, новые сверху
    byCustomer(customerId) {
      return [...orders.values()]
        .filter((o) => o.customerId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
