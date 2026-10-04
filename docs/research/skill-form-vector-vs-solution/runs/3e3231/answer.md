**Изменённые файлы:**
- `Model.cs` — добавлено `Order.Complexity` (int, CHECK 1..5); `CreatedAt` замаплен через `ValueConverter` (UTC в коде при неизменной колонке `timestamp without time zone`); в `OnModelCreating` явно настроены required-связи `Order→Items` и `Order→Payments` (`HasForeignKey` + `DeleteBehavior.Cascade`).
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)` (`Include(Items)` → `Items.Clear()` → `SaveChangesAsync()`).

**Решения:**
- `Cascade` вместо `Restrict`/`ClientSetNull` для обязательных FK — иначе `Items.Clear()`+`SaveChanges` кидает `InvalidOperationException` при разрыве required-связи; заодно корректно ведёт себя при редком физическом DELETE заказа.
- UTC для `CreatedAt` — через `ValueConverter`, который на запись снимает/приводит `Kind`, а на чтение проставляет `Utc`; применяется и к параметрам запросов, не только к материализации, тип колонки не тронут.
- Диапазон `Complexity` закреплён CHECK-constraint в БД, а не только в коде.

Ответ также записан в `_answer.md`.