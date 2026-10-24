Создан файл: `OrderQueries.cs` (новый сервис `Shop.Data.OrderQueries`) и `_answer.md` с описанием.

Решения:
- (а) карточка заказа — `Include` без `AsSplitQuery` (single entity, JOIN дешевле лишнего roundtrip'а); (б) выгрузка заказов клиента — те же два `Include`, но с `AsSplitQuery`, т.к. список может быть большим и два Include дают cartesian explosion; оба метода с `AsNoTracking` (read-only).
- (в) `GetProductBySkuAsync(sku, warehouse?)`: при заданном складе — `SingleOrDefaultAsync` (уникально по контракту); при `warehouse == null` — не вызываю голый `Single()` на неуникальном условии, а явно разруливаю 0/1/>1 совпадений, бросая исключение при неоднозначности.
- (г) `GetLastShippedAtAsync`: агрегат `MaxAsync` в SQL, возврат `DateTime` без null-forgiving — при отсутствии отгруженных заказов бросаю исключение вместо подавления через `!`.