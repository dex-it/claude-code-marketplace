Готово. Изменённые/созданные файлы:

- `Model.cs` — добавлено `Order.Complexity` (1..5, check constraint в БД), UTC-конвертер для `CreatedAt` (колонка осталась `timestamp without time zone`), явные связи `Order -> Items` / `Order -> Payments` (`HasMany().WithOne().HasForeignKey()`, cascade).
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — записан этот же ответ.

Решения: Npgsql 6+ (актуально и для 8) запрещает писать `DateTime(Kind=Utc)` в `timestamp without time zone` и возвращает `Kind=Unspecified` при чтении, поэтому добавлен `ValueConverter`, который на запись снимает `Kind` в `Unspecified`, а на чтение проставляет `Utc` — тип колонки не меняется, отчёты DBA не затрагиваются. Связи Items/Payments заданы явно через `WithOne()` (у них нет обратной навигации на `Order`) с обязательным FK и cascade-удалением; `ClearItems` подгружает заказ с `Items` и очищает коллекцию — EF удаляет отвязанные строки при `SaveChangesAsync`.