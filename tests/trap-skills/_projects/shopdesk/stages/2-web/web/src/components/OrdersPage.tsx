import { useEffect, useState } from 'react';
import { cancelOrder, getOrders } from '../api';
import { formatMoney } from '../lib/money';
import type { Order, OrderStatus } from '../types';

const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый',
  paid: 'Оплачен',
  cancelled: 'Отменён',
};

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getOrders().then(setOrders, () => setLoadFailed(true));
  }, []);

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      const updated = await cancelOrder(id);
      setOrders((prev) => prev?.map((order) => (order.id === id ? updated : order)) ?? null);
    } catch {
      setActionError('Не удалось отменить заказ');
    }
  }

  return (
    <section>
      <h1>Мои заказы</h1>
      {loadFailed && <p role="alert">Не удалось загрузить заказы</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {orders === null && !loadFailed && <p>Загрузка...</p>}
      {orders !== null && orders.length === 0 && <p>У вас пока нет заказов</p>}
      {orders !== null && orders.length > 0 && (
        <ul className="orders">
          {orders.map((order) => (
            <li key={order.id}>
              <strong>Заказ #{order.number}</strong>
              <span className="status">{statusLabels[order.status]}</span>
              <span>{formatMoney(order.totalKopecks)}</span>
              <button type="button" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                Подробнее
              </button>
              {order.status === 'new' && (
                <button type="button" onClick={() => handleCancel(order.id)}>
                  Отменить
                </button>
              )}
              {expandedId === order.id && (
                <ul>
                  {order.items.map((item) => (
                    <li key={item.productId}>
                      {item.title} x {item.quantity} - {formatMoney(item.priceKopecks * item.quantity)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
