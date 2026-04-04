---
name: deep-audit
description: Глубокий критический аудит компонента/модуля — архитектура, контракты, concurrency, обработка ошибок, безопасность, тесты. Активируется при audit, критический анализ, аудит компонента, deep review, race condition, thread safety, SQL injection, memory leak, dispose, double fault, N+1, deadlock, security review, анализ модуля
argument-hint: [путь | ветка | файл]
---

# /deep-audit — Component Deep Audit

Полный критический анализ компонента/модуля. Стек-агностичный. Не привязан к конкретному PR — анализирует компонент "как есть".

## Определение цели аудита

Аргумент `$ARGUMENTS` может быть:
- **Путь к директории:** `src/payments/` — аудит всех файлов компонента
- **Путь к файлу:** `src/payments/service.ts` — аудит файла и его зависимостей
- **Ветка:** `feature/new-auth` — аудит изменений в ветке (`git diff main...HEAD`)
- **Пусто:** спроси пользователя — "Какой компонент анализировать? Укажи путь, файл или ветку."

## When to Use

- "Критический анализ компонента X"
- "Проведи аудит модуля Y"
- "Что не так с этим компонентом?"
- Перед крупным рефакторингом
- Первое знакомство с незнакомым модулем
- Due diligence перед интеграцией чужого кода

## Workflow

```
Phase 1: Разведка (параллельно)
┌─────────────────┐  ┌─────────────────┐
│ scout: карта     │  │ scout: SQL,     │
│ файлов, классов, │  │ concurrency,    │
│ интерфейсов      │  │ error handling  │
└────────┬────────┘  └────────┬────────┘
         │                    │
         ▼                    ▼
Phase 2: Глубокое чтение (main context)
         Прочитать ключевые файлы
                    │
                    ▼
Phase 3: Анализ по чеклисту
         8 аспектов → находки
                    │
                    ▼
Phase 4: Отчёт
         Critical / Medium / Minor
```

## Phase 1: Разведка

Запустить **2 параллельных агента** (Agent tool, subagent_type: `scout` если доступен, иначе `general-purpose`):

### Агент 1 — Карта компонента
```
Найди ВСЕ файлы компонента [X]:
1. Манифесты проекта (package.json, csproj, go.mod, Cargo.toml, pyproject.toml)
2. Публичные контракты (интерфейсы, абстрактные классы, экспорты, типы)
3. Ключевые реализации (entry point, основная логика)
4. Модели данных (entities, DTO, schemas)
5. Конфигурация и DI-регистрация
6. Тесты
7. Фоновые задачи (workers, cron, schedulers)

Для каждого файла: путь, ключевые классы/функции, роль.
```

### Агент 2 — Опасные паттерны
```
Найди в компоненте [X]:
1. Raw SQL / строковые запросы (интерполяция, конкатенация в запросах)
2. Блокировки (FOR UPDATE, SKIP LOCKED, lock, mutex, synchronized)
3. Метапрограммирование (reflection, eval, dynamic import, monkey patching)
4. Retry / polling (while + delay, setInterval, cron, BackgroundService)
5. Exception handling — все catch/except/rescue блоки
6. Глобальное состояние (static, global, module-level mutable)
7. Работа со временем (Date.now, DateTime.Now, time.Now — app vs DB time)
8. Примитивы concurrency (locks, channels, atomics, semaphores)

Для каждой находки: файл, строка, код.
```

> **Fallback:** если Agent tool недоступен — выполни обе задачи последовательно через Glob + Grep + Read.

## Phase 2: Глубокое чтение

На основе карты от Агента 1 — **прочитать** (не grep!) до **10-15 ключевых файлов**:
- Публичные контракты (интерфейсы, типы, экспорты)
- Основную реализацию (entry point компонента)
- Data access (repository, ORM, queries)
- Фоновые задачи (если есть)
- Конфигурацию и DI/wiring

> Если компонент больше 15 файлов — фокус на entry point, публичных контрактах и data access. Остальное — по результатам Агента 2 (опасные паттерны).

## Phase 3: Анализ по 8 аспектам

### 3.1 Контракты и инварианты
- Что обещает публичный API? Что не обещает, но подразумевает?
- Есть ли implicit expectations? (вызывающий должен сделать X перед/после)
- Совпадает ли имя метода с его поведением? (enqueue звучит как "сохранено", но может быть только in-memory буфер)

### 3.2 Concurrency и thread safety
- Shared mutable state без синхронизации?
- Глобальные/статические обработчики — безопасны при параллельном доступе?
- Несколько инстансов компонента — гонки? (multiple workers, replicas)
- Lock granularity — слишком грубая (весь batch) или тонкая (per-item)?

### 3.3 Error handling и resilience
- Catch-блоки: глотают ошибки? Логируют? Re-throw?
- **Double fault**: catch с I/O (rollback, unlock, HTTP) — если cleanup падает, оригинальная ошибка сохранена?
- Параллельные операции (Promise.all, Task.WhenAll, goroutine) — теряются ли ошибки кроме первой?
- Retry без idempotency — возможны дубликаты?

### 3.4 Data access
- Injection? (строковая интерполяция/конкатенация в запросах)
- Hardcoded values (числа вместо enum, magic strings)?
- Provider lock-in? (специфичный SQL-диалект без декларации)
- Время: app server time vs DB time — drift?
- N+1 queries? Missing indexes?

### 3.5 Resource management
- Ресурсы (connections, handles, streams) — закрываются/освобождаются?
- Lifetime mismatch? (короткоживущий ресурс захвачен долгоживущим объектом)
- Cancellation — пробрасывается? Или игнорируется?
- Memory leaks — event handlers без unsubscribe? Растущие коллекции без очистки?

### 3.6 Configuration и defaults
- Дефолтные значения — разумны? Безопасны?
- Breaking changes в дефолтах между версиями?
- Hardcoded timeouts / limits без возможности настройки?

### 3.7 Security (если компонент на границе системы)
- Input validation на входе?
- IDOR — доступ к чужим данным по ID?
- Injection — SQL, command, XSS, template injection?
- Secrets в коде / конфигах?

### 3.8 Тестовое покрытие
- Покрыты ли edge-cases из пунктов 3.2-3.4?
- Есть ли тесты на failure paths, не только happy path?
- Глобальное состояние в тестах — изоляция между тестами?

## Phase 4: Отчёт

### Классификация

| Уровень | Критерий | Примеры |
|---------|----------|---------|
| **Critical** | Потеря/дублирование данных, security, race condition | Partial commit, SQL injection, double processing |
| **Medium** | Неожиданное поведение, performance, нестрогий контракт | Implicit SaveChanges, reflection без кэша, DateTime drift |
| **Minor** | Code smell, стиль, hardcoded values | Enum числа в SQL, избыточные проверки |

### Формат находки

```
### [#] Краткое название (УРОВЕНЬ)

**Файл:** `path/to/file.cs:42`

**Код:**
```lang
// проблемный фрагмент
```

**Проблема:** Что именно не так и почему.

**Сценарий:** Конкретный сценарий, при котором проблема проявится.

**Рекомендация:** Что сделать. С примером кода если уместно.
```

### Итоговая таблица

```
| Категория | # | Описание |
|-----------|---|----------|
| Critical  | N | ... |
| Medium    | N | ... |
| Minor     | N | ... |
```

## Чего НЕ делает этот скилл

- Не делает code review PR (для этого `/review`)
- Не исследует кодовую базу поверхностно (для этого `/explore`)
- Не запускает тесты (для этого `/test`)
- Не исправляет найденные проблемы (только анализ и рекомендации)
