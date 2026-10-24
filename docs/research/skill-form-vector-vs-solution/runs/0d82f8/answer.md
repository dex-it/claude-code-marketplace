## Изменённые файлы
- `Model.cs`
- `OrderRepository.cs`

## Решения
- **Complexity**: `int Complexity` на `Order` + `CK_Order_Complexity_Range` (`BETWEEN 1 AND 5`) как check constraint — диапазон гарантирован в БД, не только в коде.
- **CreatedAt / UTC**: колонка осталась `timestamp without time zone`; добавлен `ValueConverter`, который на запись приводит значение к UTC и снимает `Kind` (Npgsql 6+ не пишет `Kind=Utc` в `without time zone`), а на чтение всегда ставит `Kind=Utc` — без изменения схемы код всегда работает с UTC независимо от таймзоны клиента.
- **Связи**: `Order.Items` — `DeleteBehavior.Cascade` (FK required), иначе `Items.Clear()+SaveChanges` падал бы `InvalidOperationException` при разрыве required-связи; `Order.Payments` — `Restrict` (финансовые записи не должны молча каскадно удаляться при случайном физическом удалении Order — мягкое удаление остаётся единственным штатным путём).
- **ClearItems**: `OrderRepository.ClearItems(Guid orderId)` — `Include(Items)` → `Items.Clear()` → `SaveChangesAsync()`; при отсутствии заказа — `KeyNotFoundException`.

Тот же текст записан в `_answer.md`.