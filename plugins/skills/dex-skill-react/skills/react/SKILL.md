---
name: react
description: React паттерны и best practices. Активируется при react, component, hook, useState, useEffect, props, JSX, TSX, frontend, Redux, Zustand, React Query, Next.js, nextjs, Remix, Vite, SPA, SSR, client component, server component, React Router, TanStack
---

# React — ловушки и anti-patterns

## useEffect

### Бесконечный цикл
Плохо: `useEffect(() => { setCount(count + 1); }, [count])` — state update → re-render → effect → ...
Правильно: убрать зависимость из deps или использовать `setCount(prev => prev + 1)` без `count` в deps
Почему: бесконечный ре-рендер, вкладка зависает. React не предупреждает — ошибка тихая

### Объект/массив в deps
Плохо: `useEffect(() => { fetch(options.url); }, [options])` — `{url: '...'}` !== `{url: '...'}`
Правильно: `useEffect(() => { fetch(url); }, [url])` — конкретные примитивные значения
Почему: объект пересоздаётся каждый render → новая ссылка → effect срабатывает каждый render = бесконечные запросы

### Stale closure
Плохо: `useEffect(() => { setInterval(() => console.log(count), 1000); }, [])` — `count` всегда 0
Правильно: добавить `count` в deps или использовать `ref` для мутабельного значения
Почему: closure захватывает значение `count` на момент создания effect. Пустые deps = closure никогда не обновляется

### Утечка памяти — нет cleanup
Плохо: `useEffect(() => { const ws = new WebSocket(url); ws.onmessage = handler; }, [url])` — без return
Правильно: `return () => ws.close()` — cleanup при unmount и перед повторным запуском
Почему: при навигации компонент размонтируется, но WebSocket/таймер/подписка остаётся → обновление state unmounted компонента, утечка памяти

### fetch без AbortController
Плохо: `useEffect(() => { fetch(url).then(setData); }, [url])` — при быстрой смене url запросы гонятся
Правильно: `const controller = new AbortController(); fetch(url, {signal}); return () => controller.abort()`
Почему: race condition — ответ на старый url приходит ПОСЛЕ нового → отображаются устаревшие данные

## useMemo / useCallback

### Преждевременная оптимизация
Плохо: `const name = useMemo(() => user.firstName + ' ' + user.lastName, [user])` — мемоизация дешёвой операции
Правильно: `const name = user.firstName + ' ' + user.lastName` — без useMemo
Почему: useMemo имеет цену (сравнение deps, хранение). Для дешёвых операций overhead > выигрыш. Используй когда: дорогие вычисления, передача в `memo()` дочерний компонент, зависимость в другом хуке

### memo без useCallback на callback props
Плохо: `<MemoChild onClick={() => doSomething()} />` — memo бесполезен
Правильно: `const handleClick = useCallback(() => doSomething(), []);` → `<MemoChild onClick={handleClick} />`
Почему: inline arrow function = новая ссылка каждый render → memo всегда считает что props изменились → ре-рендер всё равно происходит. memo потратил время зря

### useMemo для JSX
Плохо: `const header = useMemo(() => <Header title={title} />, [title])` — мемоизация JSX
Правильно: вынести `Header` в отдельный компонент с `memo()`
Почему: useMemo для JSX неидиоматичен, сложнее читать и дебажить. `memo()` — стандартный React-способ предотвратить ре-рендер

## State Management

### Props Drilling через 3+ уровня
Плохо: `<Page user={user}><Sidebar user={user}><UserMenu user={user} />` — прокидывание через всех
Правильно: composition (children), Context для глобального, или Zustand
Почему: каждый промежуточный компонент зависит от props, которые ему не нужны. Изменение структуры → правки во всей цепочке

### Context для часто меняющихся данных
Плохо: `<ThemeContext.Provider value={{ theme, mousePosition, scrollY }}>` — все consumers ре-рендерятся
Правильно: разделить контексты. Часто меняющиеся данные (mousePosition) — в отдельный Context или Zustand
Почему: любое изменение value → ре-рендер ВСЕХ потребителей Context. `mousePosition` на mousemove = сотни ре-рендеров в секунду всего дерева

### Серверное состояние в useState
Плохо: `const [orders, setOrders] = useState([]); useEffect(() => fetch('/orders')..., [])`
Правильно: `const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })`
Почему: useState для серверных данных = ручное управление loading/error/refetch/cache/stale. React Query решает это + дедупликация запросов, фоновый refetch, оптимистичные обновления

## Рендеринг

### key={index} в списках
Плохо: `items.map((item, i) => <Item key={i} data={item} />)` — index как key
Правильно: `items.map(item => <Item key={item.id} data={item} />)` — стабильный уникальный id
Почему: при удалении/добавлении/reorder элементов React сопоставляет по key. Index сдвигается → компоненты получают чужие props и state (input сохраняет значение от другого элемента)

### Условный рендеринг с &&
Плохо: `{count && <Badge count={count} />}` — при count=0 рендерит `0` на экране
Правильно: `{count > 0 && <Badge count={count} />}` или `{count ? <Badge count={count} /> : null}`
Почему: `0 && <Component />` возвращает `0` (falsy но рендерится React'ом). Аналогично с пустой строкой `''`

### Новый объект/массив в JSX props
Плохо: `<Chart style={{ marginTop: 10 }} data={[1,2,3]} />` — новый объект каждый render
Правильно: вынести в константу/useMemo или вне компонента если статичный
Почему: если `Chart` обёрнут в `memo()` — оптимизация сломана. Если внутри useEffect с этим prop в deps — бесконечный цикл

## Формы

### Controlled input без debounce на поиске
Плохо: `<input onChange={e => setSearch(e.target.value)} />` → запрос на каждый keystroke
Правильно: debounce перед запросом (useDeferredValue, кастомный хук, или debounce в React Query)
Почему: 10 символов = 10 запросов к API. Серверная нагрузка, race condition ответов, мерцание UI

### Потеря фокуса при ре-рендере формы
Плохо: компонент формы определён внутри другого компонента — `function Parent() { function Form() {...} }`
Правильно: `Form` определён на верхнем уровне модуля, вне `Parent`
Почему: каждый render Parent создаёт НОВЫЙ компонент Form → React размонтирует старый и монтирует новый → input теряет фокус, state сбрасывается

## Чек-лист

- useEffect: cleanup есть, deps корректны (нет объектов), AbortController для fetch
- useMemo/useCallback только когда оправдано (memo child, дорогие вычисления)
- key — стабильный id, не index
- Серверные данные — React Query/SWR, не useState+useEffect
- Нет props drilling через 3+ уровня
- Context не содержит часто меняющихся данных
- Компоненты определены на верхнем уровне модуля, не внутри других компонентов
