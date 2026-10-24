const { priceOrder } = require('./pricing');
const { formatMoney } = require('./money');

function summary(items) {
  const p = priceOrder(items);
  return [
    `Позиций: ${items.length}`,
    `Сумма: ${formatMoney(p.subtotal)}`,
    `Скидка: ${formatMoney(p.discount)}`,
    `Итого: ${formatMoney(p.total)}`,
  ];
}

module.exports = { summary };
