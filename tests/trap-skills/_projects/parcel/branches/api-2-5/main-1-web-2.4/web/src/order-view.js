export const STATUS_LABEL = {
  created: { text: 'Создан', tone: 'neutral' },
  paid: { text: 'Оплачен', tone: 'neutral' },
  packed: { text: 'Собран', tone: 'neutral' },
  shipped: { text: 'Передан в доставку', tone: 'progress' },
  delivered: { text: 'Доставлен', tone: 'success' },
  cancelled: { text: 'Отменён', tone: 'muted' },
  returned: { text: 'Возвращён', tone: 'muted' },
};

const rub = (kopecks) => `${(kopecks / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const day = (value) => new Date(value).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });

function toView(o) {
  return {
    title: `Заказ №${o.id}`,
    status: STATUS_LABEL[o.status]?.text ?? o.status,
    total: rub(o.total),
    courier: o.courier?.name,
    track: o.trackingNumber ? o.trackingNumber.toUpperCase() : '—',
    delivery: o.eta ? day(o.eta) : '—',
    created: new Date(o.createdAt).toLocaleDateString('ru-RU'),
  };
}

export async function loadOrderView(fetchImpl, baseUrl, id, customerId) {
  const res = await fetchImpl(`${baseUrl}/api/orders/${id}`, { headers: { 'x-customer-id': customerId } });
  const body = await res.json();
  if (!res.ok) {
    if (res.status === 404 && ['order-not-found', 'not_found'].includes(body.type)) return { error: 'Заказ не найден' };
    return { error: 'Ошибка сервера' };
  }
  return toView(body);
}

export async function cancelOrder(fetchImpl, baseUrl, id, customerId) {
  try {
    const res = await fetchImpl(`${baseUrl}/api/orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'x-customer-id': customerId },
    });
    if (res.status === 204) return loadOrderView(fetchImpl, baseUrl, id, customerId);
    return res.ok ? toView(await res.json()) : { error: 'Не удалось отменить' };
  } catch {
    return { error: 'Не удалось отменить' };
  }
}
