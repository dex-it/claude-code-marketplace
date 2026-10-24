// Правила скидок: суммируются, каждое округляется отдельно.
const RULES = [
  { name: 'volume', when: (subtotal) => subtotal >= 10000, rate: 0.05 },
  { name: 'loyalty', when: (subtotal, ctx) => ctx.loyalty === 'gold', rate: 0.03 },
];

function applyDiscounts(subtotal, ctx = {}) {
  return RULES.filter((r) => r.when(subtotal, ctx)).reduce((sum, r) => sum + Math.round(subtotal * r.rate), 0);
}

module.exports = { applyDiscounts, RULES };
