const { formatMoney } = require('./money');

function receiptLine(sku, qty, price) {
  return `${sku} x${qty} = ${formatMoney(qty * price)}`;
}

module.exports = { receiptLine };
