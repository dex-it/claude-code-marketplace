## Изменённые файлы
- `Model.cs`
- `OrderRepository.cs`
- `_answer.md` (создан, ответ ниже)

## Решения
- **Complexity**: поле `int Complexity` на `Order` + CHECK-констрейнт `CK_Order_Complexity_Range` (1..5) в `OnModelCreating` — валидация диапазона на уровне БД.
- **CreatedAt/UTC**: колонка осталась `timestamp without time zone`; добавлен `ValueConverter<DateTime, DateTime>` через `HasConversion` — при записи приводит к UTC (`ToUniversalTime`), при чтении помечает значение как `DateTimeKind.Utc` (`SpecifyKind`), так что в коде `CreatedAt` всегда UTC вне зависимости от таймзоны вызывающей стороны.
- **Связи и мягкое удаление**: `Order -> Items` и `Order -> Payments` явно описаны через `HasMany().WithOne().HasForeignKey(...)` с `DeleteBehavior.Cascade`; `HasQueryFilter(!IsDeleted)` на `Order` оставлен.
- **ClearItems**: `OrderRepository.ClearItems(Guid orderId)` грузит заказ с `Include(Items)`, чистит коллекцию и сохраняет — поскольку `OrderItem.OrderId` обязателен, EF удаляет отвязанные строки (orphan deletion).