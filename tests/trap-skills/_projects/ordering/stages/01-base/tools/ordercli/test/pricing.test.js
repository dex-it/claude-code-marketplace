const test = require('node:test');
const assert = require('node:assert');
const { priceOrder } = require('../src/pricing');
const { summary } = require('../src/cart');

test('скидка 5% от 10000', () => {
  const p = priceOrder([{ qty: 1, price: 12000 }]);
  assert.strictEqual(p.discount, 600);
  assert.strictEqual(p.shipping, 0);
});
test('доставка до порога', () => {
  assert.strictEqual(priceOrder([{ qty: 1, price: 1000 }]).shipping, 490);
});
test('summary форматирует деньги', () => {
  assert.strictEqual(summary([{ qty: 1, price: 12000 }])[3], 'Итого: 114.00');
});
