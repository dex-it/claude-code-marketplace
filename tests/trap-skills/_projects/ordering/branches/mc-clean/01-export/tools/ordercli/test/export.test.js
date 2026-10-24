const test = require('node:test');
const assert = require('node:assert');
const { toCsv } = require('../src/export');

test('csv: заголовок и строка', () => {
  assert.strictEqual(toCsv([{ id: 1, sku: 'A1', qty: 2, total: 1998 }]), 'id;sku;qty;total\n1;A1;2;19.98');
});
