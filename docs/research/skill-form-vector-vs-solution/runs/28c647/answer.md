Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, check-constraint 1..5); `CreatedAt` замаплен через `ValueConverter<DateTime,DateTime>` (колонка осталась `timestamp without time zone`, но код всегда получает `Kind=Utc`); в `OnModelCreating` явно настроены обязательные связи `Order → Items` и `Order → Payments` (`HasForeignKey` + `IsRequired()` + `OnDelete(Cascade)`).
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)`: загружает заказ с `Items`, `Items.Clear()`, `SaveChangesAsync()`.
- `_answer.md` — тот же ответ.

Ключевые решения: тип колонки `CreatedAt` не менялся ради отчётов DBA — UTC гарантируется конвертером (на запись приводит к UTC, на чтение проставляет `Kind=Utc`, т.к. Npgsql для `timestamp without time zone` иначе отдаёт `Unspecified`). FK `Items`/`Payments` сделаны required + Cascade — именно это заставляет `Items.Clear()` удалять осиротевшие строки, а не падать на попытке обнулить non-nullable `OrderId`.