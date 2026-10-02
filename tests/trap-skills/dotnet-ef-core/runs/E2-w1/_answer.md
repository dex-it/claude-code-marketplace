Создан файл:
- /Users/anonymous/.cache/review/pr280/runs/E2-W1/OrderQueries.cs — новый сервис `OrderQueries` (namespace `Shop.Data`), 4 метода: `GetOrderCardAsync`, `GetCustomerOrdersAsync`, `GetProductBySkuAsync`, `GetLastShippedAtAsync`.

Изменённых файлов нет (Model.cs, OrderRepository.cs, Shop.Data.csproj не трогал).

Ключевые решения:
- Все выборки — `AsNoTracking()` (read-only); в (б) на два коллекционных `Include` (Items+Payments) добавлен `AsSplitQuery()`, иначе при тысячах заказов JOIN даёт декартово произведение Items×Payments на каждый заказ; метод отдаёт `IAsyncEnumerable<Order>`, а не `List`, чтобы не грузить всю выгрузку клиента в память разом.
- (в) `GetProductBySkuAsync(sku, warehouse)`: при указанном складе — `SingleOrDefaultAsync` по (Sku, Warehouse), т.к. на складе SKU уникален; при `warehouse == null/""` ищем по всему SKU и либо возвращаем единственный найденный товар, либо кидаем `InvalidOperationException`, если SKU лежит на нескольких складах и без склада не разрешить неоднозначность (тихо отдавать случайный склад — источник багов по остаткам/цене).
- (г) `GetLastShippedAtAsync`: агрегат `MAX(ShippedAt)` по клиенту; ShippedAt не имеет явного `HasColumnType` (в отличие от CreatedAt) — по конвенции Npgsql 6+ это `timestamptz`, значение приходит с `Kind=Utc`. Контракт метода — non-nullable `DateTime`, поэтому при отсутствии отгруженных заказов явно бросаем исключение вместо фиктивной даты.
