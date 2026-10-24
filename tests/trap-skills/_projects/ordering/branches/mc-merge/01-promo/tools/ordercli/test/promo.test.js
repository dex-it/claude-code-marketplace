const test = require('node:test');
const assert = require('node:assert');
const { priceOrder } = require('../src/pricing');

test('REQ-0014: WELCOME10 даёт 10% поверх скидки по сумме', () => {
  assert.strictEqual(priceOrder([{ qty: 1, price: 12000 }], { promo: 'WELCOME10' }).discount, 1800);
});
