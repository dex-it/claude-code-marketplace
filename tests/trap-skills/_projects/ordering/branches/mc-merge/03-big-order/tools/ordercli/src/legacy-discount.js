// Скидка по сумме заказа: 5% от 10000 центов, ещё 2% от 20000.
function legacyDiscount(subtotal) {
  let d = 0;
  if (subtotal >= 10000) d += Math.round(subtotal * 0.05);
  if (subtotal >= 20000) d += Math.round(subtotal * 0.02);
  return d;
}
module.exports = { legacyDiscount };
