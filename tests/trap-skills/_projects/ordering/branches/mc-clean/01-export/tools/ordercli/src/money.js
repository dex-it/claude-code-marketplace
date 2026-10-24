// Деньги - целые центы; формат вывода 12.34.
function formatAmount(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
module.exports = { formatAmount };
