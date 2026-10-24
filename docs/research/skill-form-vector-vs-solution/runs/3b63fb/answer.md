Создан файл: `OrderQueries.cs` (Shop.Data).

Решения:
- (а) карточка заказа — `Include(Items)+Include(Payments)` без `AsSplitQuery` (single entity: JOIN эффективнее доп. roundtrip'ов), `AsNoTracking` — read-only.
- (б) заказы клиента — те же два `Include`, но с `AsSplitQuery`, т.к. тысячи заказов × Items × Payments дают cartesian explosion при обычном JOIN.
- (в) `GetProductBySkuAsync(sku, warehouse)` с nullable `warehouse`: при заданном складе sku+warehouse уникальны → `SingleOrDefaultAsync`; при `warehouse == null` sku может встречаться на нескольких складах → `FirstOrDefaultAsync`, чтобы не словить `InvalidOperationException` от `Single()`.
- (г) дата последней отгрузки — `MaxAsync(o => o.ShippedAt)` с `WHERE ShippedAt != null` (агрегация в SQL, не в памяти); при отсутствии отгруженных заказов бросаем исключение, чтобы сохранить non-nullable контракт `DateTime`.

Тот же текст записан в `_answer.md`.