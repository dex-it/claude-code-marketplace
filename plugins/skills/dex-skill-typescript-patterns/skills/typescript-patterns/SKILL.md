---
name: typescript-patterns
description: TypeScript ловушки — типизация, async/await, runtime vs compile-time. Активируется при typescript, ts, type, interface, generic, async, promise, tsconfig
---

# TypeScript — ловушки и anti-patterns

## Типизация

### any вместо unknown
Плохо: `function parse(data: any) { return data.name }` — ни одной проверки, crash в runtime
Правильно: `function parse(data: unknown) { if (typeof data === 'object' && data && 'name' in data) ... }`
Почему: any отключает type checker полностью. unknown заставляет проверить тип перед использованием

### Type assertion вместо narrowing
Плохо: `const user = data as User` — если data не User, crash позже в неожиданном месте
Правильно: type guard: `function isUser(data: unknown): data is User { return 'id' in data && 'name' in data }`
Почему: `as` обманывает компилятор, не проверяет runtime. Ошибка появится далеко от места assertion

### Enum вместо union type
Плохо: `enum Status { Active, Inactive }` — генерирует runtime объект, tree-shaking не удаляет
Правильно: `type Status = 'active' | 'inactive'` или `const Status = { Active: 'active', Inactive: 'inactive' } as const`
Почему: enum = runtime код. Union type = только compile-time, zero runtime cost. Enum с числовыми значениями ещё и unsafe: `Status[999]` не ошибка

### Забытый return type на public API
Плохо: `function getUser(id: string) { return db.find(id) }` — return type inferred, ломается при рефакторинге
Правильно: `function getUser(id: string): Promise<User | null>` — explicit return type
Почему: inferred type меняется тихо при изменении реализации. Consumers ломаются без ошибки в самой функции

### Non-null assertion в production
Плохо: `const name = user!.name` или `document.getElementById('app')!`
Правильно: `if (!user) throw new Error('...')` или optional chaining `user?.name`
Почему: `!` говорит "я знаю что не null" — но в runtime может быть null. Crash без полезного сообщения

## async/await

### Последовательные await вместо параллельных
Плохо: `const a = await fetchA(); const b = await fetchB()` — суммарное время = A + B
Правильно: `const [a, b] = await Promise.all([fetchA(), fetchB()])` — время = max(A, B)
Почему: если запросы независимы — нет причины ждать первый перед вторым. 2 запроса по 500ms = 1000ms vs 500ms

### Promise.all без error handling
Плохо: `Promise.all([taskA(), taskB()])` — одна ошибка = всё отвергнуто, успешные результаты потеряны
Правильно: `Promise.allSettled()` когда нужны partial results, `Promise.all()` когда нужен all-or-nothing
Почему: Promise.all reject на первой ошибке. Если taskA прошла, taskB упала — результат taskA потерян

### Забытый await
Плохо: `try { saveToDb(data) } catch (e) { ... }` — saveToDb возвращает Promise, catch не ловит rejection
Правильно: `await saveToDb(data)` — или ESLint rule `no-floating-promises`
Почему: без await Promise rejection уходит в unhandled rejection. try/catch ловит только sync ошибки

### .then/.catch смешивание с async/await
Плохо: `async function load() { return fetch(url).then(r => r.json()).catch(e => null) }`
Правильно: `const res = await fetch(url); return await res.json();` — единый стиль
Почему: смешивание создаёт непредсказуемый control flow. Ошибка в .then не попадает в outer try/catch

## Runtime ловушки

### typeof null === 'object'
Плохо: `if (typeof value === 'object') value.key` — null проходит проверку → crash
Правильно: `if (value !== null && typeof value === 'object')`
Почему: исторический баг JS. typeof null === 'object' — всегда проверяй null отдельно

### Сравнение объектов через ===
Плохо: `if (a === b)` где a и b — объекты с одинаковым содержимым → false
Правильно: deep equality: `JSON.stringify(a) === JSON.stringify(b)` или библиотека (lodash.isEqual)
Почему: === сравнивает ссылки, не содержимое. Два объекта `{x: 1}` !== `{x: 1}`

### Мутация аргументов
Плохо: `function addItem(arr: string[], item: string) { arr.push(item); return arr }` — мутирует входной массив
Правильно: `return [...arr, item]` — новый массив
Почему: caller не ожидает что его массив изменится. Особенно опасно в React (state мутация = нет ре-рендера)

## tsconfig

### strict: false
Плохо: `"strict": false` или отсутствует — TS работает как JS с аннотациями
Правильно: `"strict": true` с первого дня
Почему: без strict: implicit any, nullable без проверок, this любого типа. Включить позже на большом проекте — сотни ошибок

### skipLibCheck: true скрывает ошибки зависимостей
Плохо: `skipLibCheck: true` чтобы "починить" ошибки в node_modules — проблема не в lib, а в версиях типов
Правильно: разберись с конфликтующими @types версиями. `skipLibCheck` = последнее средство
Почему: скрывает реальные type ошибки в .d.ts файлах, которые потом стреляют в runtime

## Чек-лист

- `strict: true` в tsconfig
- unknown вместо any, type guards вместо as
- Explicit return types на public API
- Параллельные await через Promise.all
- Нет floating promises (ESLint: no-floating-promises)
- Union types вместо enum для simple cases
- Нет мутации аргументов
