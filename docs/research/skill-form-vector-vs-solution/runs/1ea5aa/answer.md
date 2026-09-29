Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, check-constraint 1..5); для `CreatedAt` добавлен `HasConversion` без изменения типа колонки; в `OnModelCreating` явно настроены связи `Order -> Items` и `Order -> Payments` (обязательные, `OnDelete(Cascade)`).
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — тот же ответ.

Решения:
- Npgsql 6+ строго сверяет `DateTime.Kind` с типом колонки: `timestamp without time zone` не принимает `Kind=Utc` при записи и всегда возвращает `Unspecified` при чтении. Колонку менять нельзя, поэтому добавлен `ValueConverter`: на запись `Kind` снимается до `Unspecified` (значение не меняется, т.к. в коде всегда пишут `UtcNow`), на чтение восстанавливается до `Utc` — код всегда видит UTC, DBA-отчёты не затронуты.
- `Items`/`Payments` объявлены как обязательные связи (`IsRequired` + FK на non-nullable `OrderId`) с `OnDelete(Cascade)` — явная фиксация поведения защищает от разрыва required-связи и не зависит от того, что `Order` удаляется мягко.
- `ClearItems` реализован одним `ExecuteDeleteAsync()` по `OrderItem.OrderId` — без загрузки сущностей и без цикла `SaveChanges`, единым SQL DELETE в одной транзакции.