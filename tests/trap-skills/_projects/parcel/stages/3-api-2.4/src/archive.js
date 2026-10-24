// Заказы с номерами до 1000 оформлены больше года назад и перенесены в архив (только чтение).
const FIRST_ACTIVE_ID = 1000;

export function createArchive(orders = []) {
  const byId = new Map(orders.map((order) => [String(order.id), order]));
  return {
    covers(id) {
      const n = Number(id);
      return Number.isInteger(n) && n > 0 && n < FIRST_ACTIVE_ID;
    },
    get(id) {
      return byId.get(String(id));
    },
  };
}
