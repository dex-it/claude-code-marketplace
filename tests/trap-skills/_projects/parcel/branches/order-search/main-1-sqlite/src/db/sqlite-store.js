import { DatabaseSync } from 'node:sqlite';

// Хранилище заказов в SQLite. Документ заказа - JSON в столбце doc, поля для выборок - отдельными столбцами.
// Интерфейс тот же, что у хранилища в памяти (src/store.js): get, put, all, byCustomer.
export function createSqliteStore({ path = ':memory:', seed = [] } = {}) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      doc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id, created_at);
  `);
  const upsert = db.prepare(`
    INSERT INTO orders (id, customer_id, customer_name, status, created_at, doc)
    VALUES (:id, :customerId, :customerName, :status, :createdAt, :doc)
    ON CONFLICT (id) DO UPDATE SET
      customer_id = excluded.customer_id, customer_name = excluded.customer_name,
      status = excluded.status, created_at = excluded.created_at, doc = excluded.doc
  `);
  const byId = db.prepare('SELECT doc FROM orders WHERE id = ?');
  const parse = (row) => (row ? JSON.parse(row.doc) : undefined);

  const store = {
    get(id) {
      const n = Number(id);
      return Number.isInteger(n) ? parse(byId.get(n)) : undefined;
    },
    put(order) {
      upsert.run({
        id: Number(order.id),
        customerId: order.customerId,
        customerName: order.customer?.name ?? '',
        status: order.status,
        createdAt: order.createdAt,
        doc: JSON.stringify(order),
      });
      return order;
    },
    all() {
      return db.prepare('SELECT doc FROM orders ORDER BY id').all().map(parse);
    },
    // заказы клиента, новые сверху
    byCustomer(customerId) {
      return db
        .prepare(`SELECT doc FROM orders WHERE customer_id = '${customerId}' ORDER BY created_at DESC`)
        .all()
        .map(parse);
    },
    close() {
      db.close();
    },
  };
  if (store.all().length === 0) for (const order of seed) store.put(order);
  return store;
}
