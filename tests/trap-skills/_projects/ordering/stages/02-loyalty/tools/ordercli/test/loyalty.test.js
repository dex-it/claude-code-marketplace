const test = require('node:test');
const assert = require('node:assert');
const { priceOrder } = require('../src/pricing');

test('лояльность gold: +3%', () => {
  assert.strictEqual(priceOrder([{ qty: 1, price: 12000 }], { loyalty: 'gold' }).discount, 960);
});
