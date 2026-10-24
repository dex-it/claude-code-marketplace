**Изменённые/созданные файлы:**
- `Model.cs` — добавлено `Order.Complexity` (int, 1..5) с check-constraint `CK_Order_Complexity` в БД; для `CreatedAt` добавлен `ValueConverter` (пишет всегда в UTC, читает с `Kind=Utc`), тип колонки `timestamp without time zone` не тронут; в `OnModelCreating` явно настроены `HasMany().WithOne().HasForeignKey(...)` для `Order.Items` и `Order.Payments` с `DeleteBehavior.Cascade`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`: подгружает заказ с `Items`, делает `Items.Clear()` и `SaveChangesAsync()`.
- `_answer.md` — этот же ответ.

**Решения:**
- UTC гарантируется конвертером EF (`HasConversion`), а не ручным `SpecifyKind` в коде — работает для всех запросов, колонку для DBA менять не пришлось.
- Диапазон `Complexity` закреплён check-constraint'ом на уровне БД, а не только валидацией в коде.
- Cascade для `Items`/`Payments` выбран из-за обязательного `OrderId` (Guid) — при отвязке/хард-делете строки не должны оставаться осиротевшими; мягкое удаление заказа по-прежнему обеспечивает `HasQueryFilter(!IsDeleted)`.