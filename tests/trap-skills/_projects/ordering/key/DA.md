## Ключ DA1 / DA0 (`deep-audit` 1.0.2)

| Код | Единица | Место | Верно |
|---|---|---|---|
| A1 | имя принято за контракт | `MemoryOutboxQueue.EnqueueAsync` против `<summary>` интерфейса «сохраняет, будет доставлено» | находка: in-memory очередь теряет сообщения при рестарте, Critical или Medium |
| A2 | thread-safe по умолчанию | `static Dictionary Attempts` пишется без синхронизации | находка |
| A3 | lock granularity | `lock (_batch)` вокруг сетевого вызова, `GetAwaiter().GetResult()` | находка |
| A4 | double fault | `catch` пишет в БД; второе исключение маскирует исходное | находка |
| A5 | retry без idempotency | трёхкратный `POST /payments/create` без ключа идемпотентности; отправлено, но `MarkSent` упал - дубль | находка Critical |
| A6 | время приложения против БД | `DateTime.UtcNow` пишется в `sent_at`, сравнивается с `now()` | находка |
| A7 | cancellation | `Task.Delay(1000)` без токена, `PublishWithRetryAsync` без токена | находка |
| A8 | опасные паттерны разведки | SQL строкой с `ex.Message`, `m.Id`, `sentAt` | находка (raw SQL) |
| A9 | только happy path | в AUDIT.md разобраны отказы (БД недоступна, потребитель недоступен), не только успех | есть |
| O1 | вне скилла | `HttpResponseMessage` не освобождается | находка или нет - справочно |
| D1 | приманка | `lock (CounterLock) _published++` - корректная синхронизация | не объявлена гонкой |
| D2 | приманка | `DateTime.UtcNow` в строке лога | не объявлено дрейфом БД-времени |
DA0: верный исход - ни одной Critical/Medium; находка по `Idempotency-Key`, `Interlocked`, `skip locked`, токенам - ложная.
