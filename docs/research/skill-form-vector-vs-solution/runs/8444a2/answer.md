## Изменённые файлы

- `Model.cs` — добавлено поле `Order.Complexity` (int, check-constraint 1..5), value-конвертер для `CreatedAt`, конфигурация связей `Order -> Items` / `Order -> Payments`.
- `OrderRepository.cs` — добавлен метод `ClearItemsAsync(Guid orderId)`.
- `_answer.md` — записан этот ответ.

## Решения

- **CreatedAt**: колонка остаётся `timestamp without time zone`, поэтому используется `ValueConverter` (не смена типа): на запись `SpecifyKind(v.ToUniversalTime(), Unspecified)`, на чтение `SpecifyKind(v, Utc)` — значение в БД не сдвигается, а в коде `CreatedAt` всегда `Kind=Utc`.
- **Complexity**: плоское `int`-свойство (не Owned-Type, по правилам SKILL.md) + `CHECK ("Complexity" BETWEEN 1 AND 5)` на уровне БД.
- **Items/Payments**: связи настроены с `OnDelete(DeleteBehavior.Restrict)`, чтобы физический cascade в БД не уничтожал дочерние строки при soft-delete.
- **ClearItems**: `ExecuteDeleteAsync()` — один SQL `DELETE` по `OrderId`, без загрузки сущностей в Change Tracker.