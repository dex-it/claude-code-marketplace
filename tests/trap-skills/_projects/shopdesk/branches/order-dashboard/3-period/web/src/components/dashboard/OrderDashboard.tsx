import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminOrders } from '../../api';
import { filterOrders, parseStatusFilter, sortByDate, summarize, type DashboardFilters } from '../../lib/dashboard';
import type { Order, OrderStatus } from '../../types';
import { DashboardContext } from './DashboardContext';
import { OrderDetails } from './OrderDetails';
import { OrderRow } from './OrderRow';
import { PeriodPicker } from './PeriodPicker';

const REFRESH_MS = 30_000;

export function OrderDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [totals, setTotals] = useState({ count: 0, seen: 0 });
  const [now, setNow] = useState(() => new Date());

  const filters: DashboardFilters = { status, from, to };

  async function load(current: DashboardFilters) {
    try {
      const list = await getAdminOrders();
      setOrders(filterOrders(list, current));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    load(filters);
  }, [filters]);

  useEffect(() => {
    setInterval(() => load(filters), REFRESH_MS);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTotals({ ...totals, count: orders.length });
  }, [orders, totals]);

  const stats = useMemo(() => summarize(orders), [orders]);

  const markSeen = useCallback(() => {
    setTotals((current) => ({ ...current, seen: current.count }));
  }, []);

  function resetFilters() {
    setStatus('all');
    setFrom('');
    setTo('');
  }

  return (
    <DashboardContext.Provider value={{ orders, filters, now }}>
      <section>
        <header className="dashboard-header">
          <h1>Дашборд заказов</h1>
          <span>{now.toLocaleTimeString('ru-RU')}</span>
        </header>

        <div className="filters">
          <label>
            Статус
            <select value={status} onChange={(e) => setStatus(parseStatusFilter(e.target.value))}>
              <option value="all">Все</option>
              <option value="new">Новые</option>
              <option value="paid">Оплаченные</option>
              <option value="cancelled">Отменённые</option>
            </select>
          </label>
          <PeriodPicker
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
          <button type="button" onClick={resetFilters}>
            Сбросить
          </button>
        </div>

        {loadFailed && <p role="alert">Не удалось обновить заказы</p>}

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', margin: '12px 0' }}>
          <span>Заказов: {stats.count}</span>
          <span>Выручка: {stats.revenueKopecks.toLocaleString('ru-RU')} ₽</span>
          <span>Новых с последнего просмотра: {totals.count - totals.seen}</span>
          <button type="button" onClick={markSeen}>
            Отметить просмотренными
          </button>
        </div>

        <button type="button" onClick={() => setOrders(sortByDate(orders))}>
          Сортировать по дате
        </button>

        <table className="dashboard">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Создан</th>
              {status === 'all' && <th>Статус</th>}
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} selected={o.id === selectedId} onSelect={() => setSelectedId(o.id)} />
            ))}
          </tbody>
        </table>

        {selectedId && <OrderDetails selectedId={selectedId} />}
      </section>
    </DashboardContext.Provider>
  );
}
