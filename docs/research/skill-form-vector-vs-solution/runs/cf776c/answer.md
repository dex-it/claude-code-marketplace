**Изменённые файлы:** `Model.cs`, `OrderRepository.cs`; создан `_answer.md` с итогами.

- `Model.cs` — добавлено `Order.Complexity` (int) с check-constraint 1..5; `CreatedAt` замаплен через `ValueConverter` (пишем `Unspecified`, читаем как `Utc`) без изменения типа колонки `timestamp without time zone`; явно настроены required-связи `Order -> Items` и `Order -> Payments` с `DeleteBehavior.Cascade`.
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)`, загружающий заказ с `Items` и делающий `Items.Clear()` + `SaveChangesAsync()`.

Ключевое решение: cascade на required-FK нужен, чтобы `Items.Clear()` не упал с `InvalidOperationException` (FK не nullable), а конвертер для `CreatedAt` держит инвариант "всегда UTC в коде", не трогая саму колонку ради DBA-отчётов.