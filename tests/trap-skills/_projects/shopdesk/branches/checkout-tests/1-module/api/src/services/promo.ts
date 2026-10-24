export interface PromoResult {
  applied: boolean;
  discountKopecks: number;
}

interface PromoRule {
  percent?: number;
  fixedKopecks?: number;
  minSubtotalKopecks: number;
}

const RULES: Record<string, PromoRule> = {
  WELCOME10: { percent: 10, minSubtotalKopecks: 100_000 },
  FLAT500: { fixedKopecks: 50_000, minSubtotalKopecks: 300_000 },
};

export function applyPromo(code: string | undefined, subtotalKopecks: number): PromoResult {
  if (!code) return { applied: false, discountKopecks: 0 };
  const rule = RULES[code.trim().toUpperCase()];
  if (!rule || subtotalKopecks < rule.minSubtotalKopecks) return { applied: false, discountKopecks: 0 };
  const raw =
    rule.percent !== undefined ? Math.floor((subtotalKopecks * rule.percent) / 100) : (rule.fixedKopecks ?? 0);
  return { applied: true, discountKopecks: Math.min(raw, subtotalKopecks) };
}
