## Изменённые файлы

- `Model.cs` — добавлено `Order.Complexity` (int) с check-constraint 1..5; конфигурация `CreatedAt` через `HasConversion` для UTC при неизменной колонке `timestamp without time zone`; связи `Order → Items` / `Order → Payments` явно заданы в `OnModelCreating` с `DeleteBehavior.ClientCascade`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — этот же отчёт.

## Решения (кратко)

- Complexity — плоское поле + `HasCheckConstraint` на диапазон 1..5, без owned type (не за что цепляться инварианту).
- CreatedAt — `HasConversion`: на запись UTC→`Kind=Unspecified` (Npgsql запрещает `Kind=Utc` в `timestamp`), на чтение `Kind=Utc`; колонка не тронута.
- Items/Payments — `ClientCascade`, а не `Cascade`/`Restrict`: DB-уровень без физического каскада (защита при soft-delete от прямого `DELETE FROM orders`), но EF на клиенте по-прежнему удаляет дочерние записи при `Items.Clear()`, что нужно для `ClearItems`.