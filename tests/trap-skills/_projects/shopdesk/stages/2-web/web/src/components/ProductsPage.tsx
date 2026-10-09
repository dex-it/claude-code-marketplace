import { useEffect, useState } from 'react';
import { getProducts } from '../api';
import { formatMoney } from '../lib/money';
import type { Product } from '../types';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProducts().then(
      (list) => {
        if (!cancelled) setProducts(list);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>Каталог</h1>
      {loadFailed && <p role="alert">Не удалось загрузить каталог</p>}
      {products === null && !loadFailed && <p>Загрузка...</p>}
      {products !== null && (
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Цена</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{formatMoney(product.priceKopecks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
