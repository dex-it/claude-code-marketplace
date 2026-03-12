---
name: react
description: React паттерны и best practices. Активируется при упоминании react, component, hook, useState, useEffect, props, JSX, TSX, frontend, Redux, Zustand, React Query
allowed-tools: Read, Grep, Glob
---

# React Patterns & Best Practices

## Структура компонента

```tsx
// 1. Imports
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui';
import type { Order } from '@/types';

// 2. Types
interface OrderCardProps {
  order: Order;
  onDelete: (id: string) => void;
}

// 3. Component
export function OrderCard({ order, onDelete }: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDelete = useCallback(() => {
    onDelete(order.id);
  }, [order.id, onDelete]);

  return (
    <div>
      <h3>{order.title}</h3>
      {isExpanded && <OrderDetails order={order} />}
      <Button onClick={handleDelete}>Удалить</Button>
    </div>
  );
}
```

### Правила

- Функциональные компоненты (не классы)
- Named exports (не default)
- Один компонент = один файл
- Props через interface, не inline

## Hooks

### useState — простое состояние

```tsx
// Примитивы
const [count, setCount] = useState(0);
const [name, setName] = useState('');

// Объекты — иммутабельное обновление
const [user, setUser] = useState<User | null>(null);
setUser(prev => prev ? { ...prev, name: 'New' } : prev);

// Ленивая инициализация (дорогие вычисления)
const [data, setData] = useState(() => computeExpensiveValue());
```

### useEffect — побочные эффекты

```tsx
// Загрузка данных
useEffect(() => {
  const controller = new AbortController();

  async function fetchOrders() {
    try {
      const res = await fetch('/api/orders', { signal: controller.signal });
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err);
    }
  }

  fetchOrders();
  return () => controller.abort(); // cleanup
}, []);

// Подписки
useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* ... */ };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### Частые ошибки useEffect

```tsx
// Плохо — бесконечный цикл
useEffect(() => {
  setCount(count + 1); // state update → re-render → effect → ...
}, [count]);

// Плохо — объект в deps (новая ссылка каждый render)
useEffect(() => {
  fetch(options.url);
}, [options]); // { url: '...' } !== { url: '...' }

// Хорошо — конкретные значения
useEffect(() => {
  fetch(url);
}, [url]);
```

### useMemo / useCallback — оптимизация

```tsx
// useMemo — кеширование вычислений
const filtered = useMemo(
  () => orders.filter(o => o.status === status),
  [orders, status]
);

// useCallback — стабильная ссылка на функцию
const handleSubmit = useCallback((data: FormData) => {
  onSubmit(data);
}, [onSubmit]);
```

**Не оборачивай всё подряд** — useMemo/useCallback имеют свою цену. Используй когда:
- Передаёшь в `memo()` дочерний компонент
- Дорогие вычисления (фильтрация больших массивов)
- Зависимость в другом хуке

### Custom Hooks — переиспользование логики

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// Использование
const debouncedSearch = useDebounce(searchQuery, 300);
```

## State Management

### Когда что использовать

| Тип состояния | Решение |
|---------------|---------|
| Локальное UI (открыт/закрыт) | `useState` |
| Форма | `react-hook-form` или `useState` |
| Серверные данные | React Query / SWR |
| Глобальное клиентское | Zustand / Redux Toolkit |
| Тема, locale | React Context |

### React Query — серверное состояние

```tsx
function useOrders(status: string) {
  return useQuery({
    queryKey: ['orders', status],
    queryFn: () => api.getOrders(status),
    staleTime: 5 * 60 * 1000, // 5 мин кеш
  });
}

function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
```

### Zustand — глобальное состояние

```tsx
interface AuthStore {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: async (credentials) => {
    const user = await api.login(credentials);
    set({ user });
  },
  logout: () => set({ user: null }),
}));

// Использование — подписка на конкретное поле
const user = useAuthStore(state => state.user);
```

## Паттерны компонентов

### Composition вместо Props Drilling

```tsx
// Плохо — прокидывание через 3 уровня
<Page user={user}>
  <Sidebar user={user}>
    <UserMenu user={user} />

// Хорошо — composition
<Page>
  <Sidebar>
    <UserMenu user={user} />
  </Sidebar>
</Page>
```

### Controlled vs Uncontrolled

```tsx
// Controlled — родитель управляет состоянием
<Input value={name} onChange={setName} />

// Uncontrolled — компонент управляет сам
<Input defaultValue="initial" ref={inputRef} />
```

### Error Boundary

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info);
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}

// Оборачивай ключевые секции
<ErrorBoundary>
  <OrdersList />
</ErrorBoundary>
```

## Performance

### React.memo — пропуск ре-рендера

```tsx
const OrderRow = memo(function OrderRow({ order }: { order: Order }) {
  return <tr>...</tr>;
});
```

### Виртуализация списков

```tsx
// Большие списки (1000+ элементов) — используй виртуализацию
import { useVirtualizer } from '@tanstack/react-virtual';
```

### Ленивая загрузка

```tsx
const AdminPanel = lazy(() => import('./AdminPanel'));

<Suspense fallback={<Spinner />}>
  <AdminPanel />
</Suspense>
```

## Структура проекта

```
src/
├── components/         # Переиспользуемые UI компоненты
│   ├── ui/            # Базовые (Button, Input, Modal)
│   └── shared/        # Бизнес-компоненты (OrderCard)
├── features/          # Фичи (группировка по домену)
│   ├── orders/
│   │   ├── OrderList.tsx
│   │   ├── OrderForm.tsx
│   │   ├── useOrders.ts
│   │   └── orders.api.ts
│   └── auth/
├── hooks/             # Общие custom hooks
├── types/             # TypeScript типы
├── utils/             # Утилиты
└── App.tsx
```
