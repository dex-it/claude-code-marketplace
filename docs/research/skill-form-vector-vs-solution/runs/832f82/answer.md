## Изменённые файлы

- `Model.cs`
- `OrderRepository.cs`

## Решения

- **Complexity**: добавлено поле `int Complexity` в `Order`; в `OnModelCreating` — `IsRequired()` + CHECK-constraint `CK_Order_Complexity` (`Complexity BETWEEN 1 AND 5`) на уровне БД, тип колонки не менялся.
- **CreatedAt / UTC**: колонка осталась `timestamp without time zone` (не трогал), но добавлен `ValueConverter<DateTime, DateTime>`: при записи приводит значение к UTC, при чтении помечает результат как `DateTimeKind.Utc` — в коде `CreatedAt` теперь всегда UTC независимо от таймзоны клиента, формат колонки для отчётов DBA не изменился.
- **Order → Items / Order → Payments**: явно настроены как `HasMany(...).WithOne().HasForeignKey(...).OnDelete(DeleteBehavior.Cascade)`; мягкое удаление заказа не затрагивает дочерние записи, каскад важен для реального удаления строк (например, в `ClearItemsAsync`).
- **ClearItems**: реализован как `ClearItemsAsync(Guid orderId)` в `OrderRepository` (суффикс Async — по стилю существующих методов). Загружает заказ с `Include(o => o.Items)`, очищает коллекцию и вызывает `SaveChangesAsync()` — благодаря обязательному FK `OrderItem.OrderId` EF Core удаляет orphan-записи из БД.

Тот же текст сохранён в `_answer.md`.