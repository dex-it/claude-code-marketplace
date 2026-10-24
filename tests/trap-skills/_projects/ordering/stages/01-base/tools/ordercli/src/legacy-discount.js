// Скидка по сумме заказа: 5% от 10000 центов.
function legacyDiscount(subtotal) {
  if (subtotal >= 10000) return Math.round(subtotal * 0.05);
  return 0;
}
module.exports = { legacyDiscount };
