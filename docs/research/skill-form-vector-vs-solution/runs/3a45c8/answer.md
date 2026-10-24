## Изменённые файлы
- `Model.cs` — добавлено поле `Order.Complexity`, конвертер для `CreatedAt`, конфигурация связей `Order -> Items` / `Order -> Payments`.
- `OrderRepository.cs` — добавлен метод `ClearItemsAsync(Guid orderId)`.
- `_answer.md` — записан этот ответ.

## Решения
- `Complexity` (int, 1..5) добавлен как плоское свойство `Order`, а не Owned-Type (по правилу SKILL это было бы «Owned-Type из одного поля»); диапазон закреплён `HasCheckConstraint` на БД.
- `CreatedAt`: колонка остаётся `timestamp without time zone`; добавлен `HasConversion` — на запись `ToUniversalTime()` + `SpecifyKind(Unspecified)` (Npgsql 6+ не даёт писать `Kind=Utc` в такую колонку), на чтение `SpecifyKind(Utc)`. В коде значение всегда UTC независимо от таймзоны клиента, DBA-отчёты видят прежний тип колонки.
- Связи `Order -> Items`/`Payments` настроены с `DeleteBehavior.ClientCascade`: `Clear()`+`SaveChanges` через EF штатно удаляет осиротевшие записи (required FK), но на уровне БД не создаётся `ON DELETE CASCADE` — прямой `DELETE FROM orders` мимо EF не унесёт дочерние записи, что важно при soft-delete (`IsDeleted`).