const { applyDiscounts } = require('./discounts/rules');

const FREE_SHIPPING_FROM = 5000;
const SHIPPING = 490;

function priceOrder(items, opts = {}) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = applyDiscounts(subtotal, { loyalty: opts.loyalty });
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
  const total = subtotal - discount + shipping;
  return { subtotal, discount, shipping, total };
}

module.exports = { priceOrder };
