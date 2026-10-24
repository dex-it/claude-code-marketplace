Создан файл:
- /Users/anonymous/.cache/review/pr280/runs/E2-O1/OrderQueries.cs — сервис `OrderQueries` с четырьмя read-методами.

Решения:
- (a) карточка заказа — `Include(Items)+Include(Payments)+AsNoTracking`, без `AsSplitQuery` (single entity — JOIN дешевле лишнего round-trip'а); (b) выгрузка заказов клиента — те же два `Include`, но с `AsSplitQuery`, т.к. у клиента тысячи заказов и два коллекционных Include дают cartesian explosion.
- (c) `GetProductBySku(sku, warehouse = null)`: SKU уникален только в паре (Sku, Warehouse), поэтому `SingleOrDefaultAsync` применяется только когда warehouse передан явно; при warehouse == null берём детерминированный `FirstOrDefaultAsync` после `OrderBy(Warehouse)`, а не `Single()`, который бы «выстрелил» при появлении второго склада с тем же SKU.
- (г) дата последней отгрузки — `MAX` считается в SQL (`Select(ShippedAt).MaxAsync()`), а на пустой результат у клиента без отгрузок бросается `InvalidOperationException`, а не null-forgiving `!` вслепую.
