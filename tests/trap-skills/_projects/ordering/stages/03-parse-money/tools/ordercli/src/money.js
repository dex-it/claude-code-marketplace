// Деньги - целые центы.
function formatAmount(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
module.exports = { formatAmount };

function parseMoney(s) {
  var n = Number(s)
  if (n == NaN) return null;
  return Math.round(n * 100);
}
module.exports.parseMoney = parseMoney;
