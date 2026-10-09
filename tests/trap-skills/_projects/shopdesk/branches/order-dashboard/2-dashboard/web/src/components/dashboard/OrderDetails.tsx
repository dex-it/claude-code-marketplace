import { useEffect, useState } from 'react';
import { authHeaders, saveDelivery } from '../../api';
import { formatMoney } from '../../lib/money';
import type { Order } from '../../types';
import { AddressForm } from './AddressForm';

export function OrderDetails({ selectedId }: { selectedId: string }) {
  const [details, setDetails] = useState<Order | null>(null);

  useEffect(() => {
    fetch(`/api/admin/orders/${selectedId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setDetails);
  }, [selectedId]);

  if (!details) return <p>Загрузка заказа...</p>;

  return (
    <aside className="details">
      <h2>Заказ #{details.number}</h2>
      <ul>
        {details.items.map((item) => (
          <li key={item.productId}>
            {item.title} x {item.quantity} - {formatMoney(item.priceKopecks * item.quantity)}
          </li>
        ))}
      </ul>
      <AddressForm
        key={details.id}
        initial={details.delivery}
        onSave={async (delivery) => setDetails(await saveDelivery(details.id, delivery))}
      />
    </aside>
  );
}
