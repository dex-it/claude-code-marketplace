## Изменённые файлы

- `Model.cs`
- `OrderRepository.cs`
- `_answer.md` (создан, дублирует этот ответ)

## Решения

- **Complexity**: добавлено свойство `int Complexity` на `Order`, обязательное, диапазон 1..5 обеспечен CHECK-constraint `CK_Order_Complexity_Range` в БД, а не только валидацией в C#.
- **CreatedAt / UTC**: колонка осталась `timestamp without time zone`. Добавлен `ValueConverter`, который при записи всегда приводит значение к UTC, а при чтении помечает результат `DateTimeKind.Utc` — код всегда видит UTC независимо от таймзоны клиента, отчёты DBA не затронуты.
- **Soft delete и связи**: query filter `!o.IsDeleted` сохранён; добавлены явные `HasMany(Items)/HasMany(Payments)` с `HasForeignKey(OrderId)` и `OnDelete(Cascade)`.
- **ClearItemsAsync(Guid orderId)**: грузит заказ с `Include(Items)`, `order.Items.Clear()` + `SaveChangesAsync()` — так как `OrderId` на `OrderItem` обязательный FK, EF Core удаляет осиротевшие позиции при сохранении.