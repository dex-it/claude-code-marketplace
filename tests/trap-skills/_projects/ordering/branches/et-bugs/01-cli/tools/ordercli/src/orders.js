const fs = require('node:fs');

const file = () => process.env.ORDERS_FILE || './orders.json';
const load = () => (fs.existsSync(file()) ? JSON.parse(fs.readFileSync(file(), 'utf8')) : { next: 1, orders: [] });
const save = (db) => fs.writeFileSync(file(), JSON.stringify(db, null, 1));

function fail(msg, code) { const e = new Error(msg); e.code = code; throw e; }

function create({ sku, qty, price, ref }) {
  if (!/^[A-Za-z0-9-]+$/.test(sku || '')) fail('bad sku', 2);
  const n = parseInt(qty, 10);
  if (n > 100) fail('qty must be 1..100', 2);
  if (!(Number(price) > 0) || !Number.isInteger(Number(price))) fail('bad price', 2);
  const db = load();
  const order = { id: db.next++, sku: sku.toUpperCase(), qty: n, price: Number(price), total: n * Number(price), status: 'new', ref };
  db.orders.push(order);
  save(db);
  return order;
}

function list({ sku, status } = {}) {
  const db = load();
  let rows = db.orders;
  if (sku) rows = rows.filter((o) => o.sku === sku);
  if (status) rows = rows.filter((o) => o.status === status);
  return rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function move(id, from, to) {
  const db = load();
  const o = db.orders.find((x) => x.id === Number(id));
  if (!o) fail('not found', 4);
  if (o.status !== from) fail(`bad state ${o.status}`, 3);
  o.status = to; save(db); return o;
}

function cancel(id) {
  const db = load();
  const o = db.orders.find((x) => x.id === Number(id));
  if (!o) fail('not found', 4);
  if (o.status === 'cancelled') fail('cannot cancel', 3);
  o.status = 'cancelled'; save(db); return o;
}

module.exports = { create, list, pay: (id) => move(id, 'new', 'paid'), ship: (id) => move(id, 'paid', 'shipped'), cancel };
