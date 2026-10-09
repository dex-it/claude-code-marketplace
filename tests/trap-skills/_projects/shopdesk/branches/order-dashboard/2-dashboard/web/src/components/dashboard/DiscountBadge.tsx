import { formatMoney } from '../../lib/money';

export function DiscountBadge({ amountKopecks }: { amountKopecks: number }) {
  return <span className="badge">скидка {formatMoney(amountKopecks)}</span>;
}
