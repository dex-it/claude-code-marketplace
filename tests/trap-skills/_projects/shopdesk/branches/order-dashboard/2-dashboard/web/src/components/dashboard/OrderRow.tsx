import { memo, useContext } from 'react';
import { formatMoney } from '../../lib/money';
import { statusLabels } from '../../lib/status';
import type { Order } from '../../types';
import { DashboardContext } from './DashboardContext';
import { DiscountBadge } from './DiscountBadge';

interface Props {
  order: Order;
  selected: boolean;
  onSelect: () => void;
}

export const OrderRow = memo(function OrderRow({ order, selected, onSelect }: Props) {
  const { filters } = useContext(DashboardContext);

  return (
    <tr className={selected ? 'selected' : undefined} onClick={onSelect}>
      <td>#{order.number}</td>
      <td>{new Date(order.createdAt).toLocaleString('ru-RU')}</td>
      {filters.status === 'all' && <td>{statusLabels[order.status]}</td>}
      <td>
        {formatMoney(order.totalKopecks)}{' '}
        {order.discountKopecks && <DiscountBadge amountKopecks={order.discountKopecks} />}
      </td>
    </tr>
  );
});
