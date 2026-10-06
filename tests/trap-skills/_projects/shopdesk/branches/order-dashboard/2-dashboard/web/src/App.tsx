import { useState } from 'react';
import { clearToken, getRole, getToken } from './api';
import { OrderDashboard } from './components/dashboard/OrderDashboard';
import { LoginForm } from './components/LoginForm';
import { OrdersPage } from './components/OrdersPage';
import { ProductsPage } from './components/ProductsPage';

type Tab = 'orders' | 'products' | 'dashboard';

export function App() {
  const [authorized, setAuthorized] = useState(() => getToken() !== null);
  const [tab, setTab] = useState<Tab>('orders');

  if (!authorized) {
    return (
      <main className="app">
        <LoginForm onLoggedIn={() => setAuthorized(true)} />
      </main>
    );
  }

  function logout() {
    clearToken();
    setAuthorized(false);
  }

  return (
    <main className="app">
      <nav className="tabs">
        <button type="button" aria-pressed={tab === 'orders'} onClick={() => setTab('orders')}>
          Заказы
        </button>
        <button type="button" aria-pressed={tab === 'products'} onClick={() => setTab('products')}>
          Каталог
        </button>
        {getRole() === 'admin' && (
          <button type="button" aria-pressed={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
            Дашборд
          </button>
        )}
        <button type="button" onClick={logout}>
          Выйти
        </button>
      </nav>
      {tab === 'orders' && <OrdersPage />}
      {tab === 'products' && <ProductsPage />}
      {tab === 'dashboard' && <OrderDashboard />}
    </main>
  );
}
