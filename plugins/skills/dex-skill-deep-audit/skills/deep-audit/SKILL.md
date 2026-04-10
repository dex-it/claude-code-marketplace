---
name: deep-audit
description: Глубокий аудит компонента — контракты, concurrency, error handling, безопасность. Активируется при deep audit, глубокий аудит, критический анализ, аудит компонента, race condition, thread safety, double fault, N+1, deadlock, memory leak, injection
---

# Deep Audit — ловушки компонентного аудита

## Разведка

### Grep вместо чтения файлов
Плохо: `grep -r "lock" src/` и выводы по совпадениям без контекста
Правильно: прочитать ключевые файлы целиком (entry point, data access, workers)
Почему: grep теряет контекст — вызов внутри комментария, мёртвый код, условная ветка. Ложные срабатывания и пропуски реальных проблем

### Аудит без карты компонента
Плохо: сразу читать файлы по догадке — "наверное, проблема в Repository"
Правильно: сначала найти манифесты, публичные контракты, entry point, DI-регистрацию, фоновые задачи
Почему: без карты пропускаешь workers, scheduled jobs, event handlers — именно там скрыты race conditions и resource leaks

### Пропуск опасных паттернов при разведке
Плохо: искать только бизнес-логику, игнорируя инфраструктурный код
Правильно: явно искать raw SQL, reflection, eval, retry/polling, static mutable state, DateTime.Now
Почему: инфраструктурные ловушки (injection, drift, concurrency) чаще приводят к critical issues чем бизнес-логика

## Контракты и инварианты

### Имя метода принято за контракт
Плохо: `Enqueue()` значит "сообщение гарантированно сохранено" — не проверяя реализацию
Правильно: читать реализацию — `Enqueue` может класть в in-memory буфер без persist
Почему: implicit expectations ломаются под нагрузкой или при сбое. Имя описывает intent, не гарантию

### Нет проверки инвариантов на границах
Плохо: проверять только happy path внутри модуля
Правильно: проверять что происходит при null, пустой коллекции, concurrent access, таймауте
Почему: баги живут на границах — между модулями, между потоками, между сервисами

## Concurrency

### "Thread safe по умолчанию"
Плохо: предполагать что класс thread-safe без анализа shared state
Правильно: явно искать static поля, mutable singletons, запись без lock/atomic
Почему: отсутствие synchronized/lock не значит "нет проблемы" — значит race condition тихий и проявится в production

### Lock granularity не проверена
Плохо: lock на весь batch (`lock(list) { foreach ... process }`)
Правильно: проверить scope каждого lock — можно ли заменить на per-item или lock-free структуру
Почему: coarse-grained lock создаёт contention, fine-grained — риск deadlock. Оба варианта надо осознанно выбирать

## Error Handling

### Double fault в cleanup
Плохо: catch логирует в БД, а БД недоступна — исходная ошибка потеряна
Правильно: проверять что catch/finally не содержат I/O, который может бросить второе исключение
Почему: double fault маскирует root cause. В логах видишь ошибку cleanup, а не исходную проблему

### Retry без idempotency
Плохо: retry policy на операции, которая не идемпотентна — `CreateOrder()` повторяется при timeout
Правильно: проверить наличие dedup key, unique constraint, idempotency token
Почему: retry + non-idempotent = дубликаты данных. Timeout не значит "не выполнилось" — может быть "выполнилось, ответ потерялся"

## Data Access

### App time vs DB time
Плохо: `DateTime.Now` / `Date.now()` на сервере приложений для записи в БД
Правильно: `now()` / `GETDATE()` в SQL или единый time source
Почему: drift между серверами 100ms-несколько секунд. При 3 инстансах — записи с "будущим" временем, сломанная сортировка, потерянные events

### Только happy path в анализе
Плохо: проверить что запрос работает с тестовыми данными
Правильно: анализировать failure scenarios — что при disconnect, partial commit, constraint violation
Почему: happy path работает всегда. Production падает на edge cases: deadlock при concurrent update, orphan records при partial failure

## Resource Management

### Cancellation не пробрасывается
Плохо: `async Task Process()` без CancellationToken — не останавливается при shutdown
Правильно: проверить что CancellationToken передаётся через всю цепочку до I/O вызовов
Почему: без cancellation graceful shutdown не работает — процесс убивается, транзакции обрываются, данные в inconsistent state

## Классификация находок

- **Critical** — потеря/дублирование данных, security breach, race condition с data corruption
- **Medium** — неожиданное поведение, performance degradation, implicit SaveChanges
- **Minor** — code smell, hardcoded values, отсутствие логирования
