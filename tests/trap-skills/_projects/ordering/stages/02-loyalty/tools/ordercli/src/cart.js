const { priceOrder } = require('./pricing');
const { formatAmount } = require('./money');

function summary(items, opts = {}) {
  const p = priceOrder(items, opts);
  return [
    `Товаров: ${items.length}`,
    `Сумма: ${formatAmount(p.subtotal)}`,
    `Скидка: ${formatAmount(p.discount)}`,
    `Итого: ${formatAmount(p.total)}`,
  ];
}

module.exports = { summary };
