export const STATUS_LABEL = {
  created: { text: 'Создан', tone: 'neutral' },
  paid: { text: 'Оплачен', tone: 'neutral' },
  packed: { text: 'Собран', tone: 'neutral' },
  shipped: { text: 'Передан в доставку', tone: 'progress' },
  delivered: { text: 'Доставлен', tone: 'success' },
  cancelled: { text: 'Отменён', tone: 'muted' },
};

function toView(o) {
  return {
    title: `Заказ №${o.id}`,
    status: STATUS_LABEL[o.status].text,
    total: `${o.total} ₽`,
    courier: o.courier?.name,
    track: 'trackingNumber' in o ? o.trackingNumber.toUpperCase() : '—',
    created: new Date(o.createdAt).toLocaleDateString('ru-RU'),
  };
}

export async function loadOrderView(fetchImpl, baseUrl, id, customerId) {
  const res = await fetchImpl(`${baseUrl}/api/orders/${id}`, { headers: { 'x-customer-id': customerId } });
  const body = await res.json();
  if (!res.ok) {
    if (res.status === 404 && body.type === 'order-not-found') return { error: 'Заказ не найден' };
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
