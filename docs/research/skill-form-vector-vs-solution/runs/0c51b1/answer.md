## Изменённые файлы

- `Model.cs` — добавлено поле `Order.Complexity`, конфигурация в `OnModelCreating` (check constraint 1..5, конвертер для `CreatedAt`, явные связи `Order -> Items` и `Order -> Payments`).
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — этот же ответ.

## Решения

- **CreatedAt/UTC**: колонка осталась `timestamp without time zone`. Npgsql 8 запрещает писать `DateTime` с `Kind=Utc` в такую колонку, поэтому добавлен `ValueConverter`: при записи Kind снимается до `Unspecified` (Local предварительно приводится к UTC), при чтении обратно проставляется `Kind=Utc` — хранимое значение не меняется, в коде `CreatedAt` всегда UTC.
- **Complexity**: `int` + `IsRequired()` и check constraint `CK_Order_Complexity_Range` (1..5) через `ToTable(t => t.HasCheckConstraint(...))`.
- **Связи/soft delete**: у `Order` уже был `HasQueryFilter(!IsDeleted)`; `Items`/`Payments` не имеют своего фильтра, поэтому явные `HasMany().WithOne().HasForeignKey(...).OnDelete(Cascade)` настраиваются без конфликтов.
- **ClearItems**: грузит `Order` с `Items`, `order.Items.Clear()` + `SaveChangesAsync()` — благодаря обязательному FK и `Cascade` EF помечает снятые из коллекции `OrderItem` на удаление без отдельного `DbSet<OrderItem>`.