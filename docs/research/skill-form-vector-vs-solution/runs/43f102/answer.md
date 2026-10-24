**Созданные файлы:** `OrderQueries.cs` (новый), `_answer.md` (новый, с этим же ответом).

Решения:
- (а) карточка заказа — `Include` без `AsSplitQuery` (одна сущность, JOIN эффективнее доп. roundtrip) + `AsNoTracking`; (б) выгрузка заказов клиента — `AsSplitQuery` (тысячи заказов × Items × Payments дают cartesian explosion) + `AsNoTracking`.
- (в) `GetProductBySku`: при заданном `warehouse` — `SingleOrDefaultAsync(sku && warehouse)` (безопасно, т.к. на складе SKU уникален); при `warehouse == null` не угадываем через `FirstOrDefault` — берём `Take(2)` и либо отдаём единственный результат, либо кидаем `InvalidOperationException` с просьбой уточнить склад.
- (г) `GetLastShippedAtAsync`: фильтр `ShippedAt != null` стоит до `!.Value`; если отгруженных заказов нет — явное исключение, а не `default(DateTime)`, так как возвращаемый тип не nullable.