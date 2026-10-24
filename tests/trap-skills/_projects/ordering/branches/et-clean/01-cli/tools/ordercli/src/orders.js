const fs = require('node:fs');

const file = () => process.env.ORDERS_FILE || './orders.json';
const load = () => (fs.existsSync(file()) ? JSON.parse(fs.readFileSync(file(), 'utf8')) : { next: 1, orders: [] });
const save = (db) => fs.writeFileSync(file(), JSON.stringify(db, null, 1));

function fail(msg, code) { const e = new Error(msg); e.code = code; throw e; }

function create({ sku, qty, price, ref }) {
  if (ref !== undefined && ref === '') fail('bad ref', 2);
  const db = load();
  if (ref) { const dup = db.orders.find((o) => o.ref === ref); if (dup) return dup; }
  if (!/^[A-Za-z0-9-]+$/.test(sku || '')) fail('bad sku', 2);
  if (!/^\d+$/.test(qty || '')) fail('qty must be 1..100', 2);
  const n = Number(qty);
  if (n < 1 || n > 100) fail('qty must be 1..100', 2);
  if (!/^\d+$/.test(price || '') || Number(price) < 1 || Number(price) > 1000000) fail('bad price', 2);
  const order = { id: db.next++, sku: sku.toUpperCase(), qty: n, price: Number(price), total: n * Number(price), status: 'new', ref };
  db.orders.push(order);
  save(db);
  return order;
}

function list({ sku, status } = {}) {
  const db = load();
  let rows = db.orders;
  if (sku !== undefined) rows = rows.filter((o) => o.sku === sku.toUpperCase());
  if (status !== undefined && !['new', 'paid', 'shipped', 'cancelled'].includes(status)) fail('bad status', 2);
  if (status !== undefined) rows = rows.filter((o) => o.status === status);
  return rows.sort((a, b) => a.id - b.id);
}

function move(id, from, to) {
  const db = load();
  const o = /^\d+$/.test(id || '') ? db.orders.find((x) => x.id === Number(id)) : undefined;
  if (!o) fail('not found', 4);
  if (o.status !== from) fail(`bad state ${o.status}`, 3);
  o.status = to; save(db); return o;
}

function cancel(id) {
  const db = load();
  const o = /^\d+$/.test(id || '') ? db.orders.find((x) => x.id === Number(id)) : undefined;
  if (!o) fail('not found', 4);
  if (o.status === 'cancelled' || o.status === 'shipped') fail('cannot cancel', 3);
  o.status = 'cancelled'; save(db); return o;
}

module.exports = { create, list, pay: (id) => move(id, 'new', 'paid'), ship: (id) => move(id, 'paid', 'shipped'), cancel };
