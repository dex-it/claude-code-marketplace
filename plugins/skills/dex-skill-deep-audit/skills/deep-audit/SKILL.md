---
name: deep-audit
description: Глубокий аудит компонента — контракты, concurrency, error handling, безопасность. Активируется при deep audit, глубокий аудит, критический анализ, аудит компонента, race condition, thread safety, double fault, N+1, deadlock, memory leak, injection
---

# Deep Audit — ловушки и процедура

Критический анализ компонента/модуля. Стек-агностичный. Анализирует "как есть", не привязан к PR.

## Когда нужен deep-audit

- Перед крупным рефакторингом незнакомого модуля
- Due diligence перед интеграцией чужого кода
- Запрос: "критический анализ", "что не так с компонентом", "аудит модуля"
- Триггер по контексту: concurrency, error handling, data access, security

## Ловушки аудита

| Ловушка | Проблема | Решение |
|---------|----------|---------|
| Grep вместо чтения | Контекст теряется, ложные срабатывания | Прочитать ключевые файлы целиком |
| Только happy path | Пропущены failure scenarios | Спец. фокус на catch/retry/cleanup |
| Double fault незаметен | catch с I/O теряет исходную ошибку | Проверь AggregateException / rethrow |
| "Thread safe" по умолчанию | Shared state без синхронизации | Явно ищи static/global + write paths |
| Имя метода = контракт | `enqueue` может не гарантировать persist | Читай реализацию, не сигнатуру |
| Lock granularity не проверена | Лок на batch вместо item → contention | Анализируй scope каждого lock |
| Retry без idempotency | Дубликаты при повторе | Есть ли dedup key / unique constraint |
| App time vs DB time | Drift между сервером и БД | Ищи DateTime.Now vs now() в SQL |

## Процедура: 4 фазы

### Phase 1 — Разведка (параллельно)

Запустить **2 параллельных агента** (Agent tool, `subagent_type: general-purpose`):

**Агент 1 — карта компонента:**
```
Найди файлы компонента [X]:
1. Манифесты (package.json, csproj, go.mod, Cargo.toml, pyproject.toml)
2. Публичные контракты (интерфейсы, экспорты, типы)
3. Ключевые реализации (entry point, основная логика)
4. Модели данных (entities, DTO, schemas)
5. Конфигурация, DI-регистрация, тесты
6. Фоновые задачи (workers, cron, schedulers)

Для каждого файла: путь, ключевые классы/функции, роль.
```

**Агент 2 — опасные паттерны:**
```
Найди в компоненте [X]:
1. Raw SQL, строковые запросы (интерполяция, конкатенация)
2. Блокировки (FOR UPDATE, SKIP LOCKED, lock, mutex)
3. Метапрограммирование (reflection, eval, dynamic import)
4. Retry/polling (while+delay, setInterval, cron)
5. Exception handling — все catch/except/rescue
6. Глобальное состояние (static, global, module-level mutable)
7. Работа со временем (Date.now, DateTime.Now vs DB time)
8. Primitives concurrency (locks, channels, atomics, semaphores)

Для каждой находки: файл, строка, код.
```

> Fallback: если Agent tool недоступен — последовательно через Glob + Grep + Read.

### Phase 2 — Глубокое чтение

Прочитать (не grep!) **10-15 ключевых файлов** на основе карты:
- Публичные контракты (интерфейсы, типы, экспорты)
- Entry point компонента
- Data access (repository, ORM, queries)
- Фоновые задачи
- Конфигурация и DI/wiring

> Если файлов >15 — фокус на entry point + публичных контрактах + data access. Остальное — по находкам Агента 2.

### Phase 3 — Анализ по 8 аспектам

1. **Контракты и инварианты.** Что обещает публичный API? Implicit expectations? Имя метода совпадает с поведением?
2. **Concurrency и thread safety.** Shared mutable state без синхронизации? Несколько инстансов — гонки? Lock granularity?
3. **Error handling.** Глотают/логируют/re-throw? **Double fault** в cleanup? Параллельные операции теряют ошибки? Retry без idempotency?
4. **Data access.** Injection? Hardcoded values? Provider lock-in? App time vs DB time? N+1? Missing indexes?
5. **Resource management.** Ресурсы закрываются? Lifetime mismatch? Cancellation пробрасывается? Memory leaks?
6. **Configuration и defaults.** Дефолты разумны? Breaking changes в дефолтах между версиями? Hardcoded timeouts?
7. **Security** (если на границе системы). Input validation? IDOR? Injection (SQL, command, XSS)? Secrets в коде?
8. **Тестовое покрытие.** Edge cases (2-4) покрыты? Failure paths? Изоляция глобального состояния между тестами?

### Phase 4 — Отчёт

**Классификация:**

| Уровень | Критерий | Примеры |
|---------|----------|---------|
| **Critical** | Потеря/дублирование данных, security, race | Partial commit, SQL injection, double processing |
| **Medium** | Неожиданное поведение, performance | Implicit SaveChanges, reflection без кэша, drift |
| **Minor** | Code smell, hardcoded values | Enum числа в SQL, избыточные проверки |

**Формат находки:**

```markdown
### [#] Название (УРОВЕНЬ)

**Файл:** `path/to/file:42`

**Код:** проблемный фрагмент

**Проблема:** что не так и почему

**Сценарий:** когда проявится

**Рекомендация:** что сделать
```

**Итоговая таблица:** Critical / Medium / Minor — количество и описание.

## Что НЕ входит в deep-audit

- Исправление найденных проблем
- Запуск тестов
- Рефакторинг
