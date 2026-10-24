// REQ-0014: промокод даёт процент от суммы заказа.
const PROMOS = { WELCOME10: 0.1 };

function promoDiscount(subtotal, code) {
  const rate = PROMOS[code];
  return rate ? Math.round(subtotal * rate) : 0;
}

module.exports = { promoDiscount };
