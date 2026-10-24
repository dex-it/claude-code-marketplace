const { formatAmount } = require('./money');

function toCsv(orders) {
  const rows = orders.map((o) => `${o.id};${o.sku};${o.qty};${formatAmount(o.total)}`);
  return ['id;sku;qty;total', ...rows].join('\n');
}

module.exports = { toCsv };
