## Итог ревью

**High**
- `CustomerExport.CustomersWithOrders` — `Distinct()` по `Customer` после `AsNoTracking().Include()` не дедуплицирует: без identity resolution каждая строка `Order` даёт новый объект `Customer`, а `Customer` не переопределяет `Equals`/`GetHashCode`, так что сравнение идёт по ссылке. Клиенты с несколькими заказами попадут в выгрузку дублями.
- `SalesReport.Build` — `GetAllAsync()` тянет все продукты целиком (включая `Image byte[]`) и фильтрует `IsActive` уже в памяти; плюс внутри `Select` по продуктам делается `items.Where(i => i.ProductId == p.Id)` — поиск по списку в цикле, O(products × items).
- `StockImport.Import` — тот же паттерн: полная загрузка `Products` (с `Image`) ради апдейта `Stock`, и `products.FirstOrDefault(...)` внутри `foreach` по CSV — линейный поиск на каждую строку файла.

**Medium**
- `CustomerExport.HasOrders` — `CountAsync(...) > 0` вместо `AnyAsync(...)`.

**Low / Low-Medium**
- `CatalogSearch.Search` — 4 ветки, каждая со своей материализацией, вместо одного `IQueryable` с условными `.Where` — риск расхождения логики веток при будущих изменениях.
- `SalesReport.Build` — читающие запросы без `AsNoTracking()`.
- `StockImport.Import` — дубли `productId` в CSV искажают счётчик `Updated`.

Полный текст с обоснованиями и severity записан в `/Users/anonymous/.cache/research/runs/4b6a66/work/_answer.md`. Код не менял, сборку/тесты не запускал.