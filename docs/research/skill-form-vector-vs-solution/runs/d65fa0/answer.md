**Созданные/изменённые файлы:**
- `CustomerNotifier.cs` (новый) — класс `CustomerNotifier` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)`.
- `_answer.md` (новый) — тот же отчёт.

**Решения:** список id материализуется один раз и очищается через `Distinct()` (защита от повторного обхода `IEnumerable` и дублей во входном списке); запрос к БД идёт батчами по 2000 id вместо одного огромного `Contains` или запроса в цикле по каждому id, а из `Customers` берётся только `Email` через `Select`, без загрузки полной сущности.