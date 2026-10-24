Создан файл `CustomerNotifier.cs` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)`.

Решения:
- id дедуплицируются (`Distinct()`) — список из маркетинговой системы может содержать дубли.
- id разбиваются на чанки по 500 и запрос идёт пакетами (`Contains` по батчу), а не одним большим `IN(...)` и не в цикле по каждому клиенту.
- Из БД берётся только `Email` через `Select` + `AsNoTracking`, а не полная сущность `Customer`.

Ответ также записан в `_answer.md`.