## Ревью MR !4127

Ответ записан в `_answer.md`. Кратко — главные блокеры:

**Critical**
1. `Migrations/20260920_OrderCategories.cs` — дроп `Orders.Category` без переноса данных в новые таблицы → потеря данных о категориях.
2. `Model.cs`/`Services/OrderAdmin.cs:UpdateOrder` — модель не обновлена под новую схему, `order.Category` пишется в несуществующую колонку.
3. `Services/OrderAdmin.cs:RecalcTotal` — сумма считается без `Qty`, только по `Price`.
4. `Services/OrderQueries.cs:GetProductBySku` — `SingleAsync` по SKU, который не уникален (несколько складов).
5. `Services/CatalogService.cs:Reserve` — `FOR UPDATE` без охватывающей транзакции, лок снимается до `SaveChangesAsync` → гонка при резерве остатка.
6. `Workers/OverdueNotifier.cs` (конструктор) — scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService`.
7. `Workers/OverdueNotifier.cs:ExecuteAsync` — `AuditLog.At = DateTime.UtcNow` (Kind=Utc) пишется в колонку `timestamp without time zone` → падает `SaveChangesAsync` при каждом найденном просроченном заказе.

**High**: `ExportForCustomer` без `AsSplitQuery` при тысячах заказов; `LastShippedAt` — `!.Value` на возможном null; `UpdateOrder`/`RecalcTotal` без concurrency-контроля при параллельной правке; `OverdueReport` — материализация всей таблицы `Orders` с фильтром после материализации; `Reprice` — лишний `UpdateRange` на трекаемых сущностях, затирающий все колонки.

**Medium**: `RecalcTotal` тянет полные `Product`-сущности вместо проекции Id/Price; `CatalogService.Search` — динамически собираемый `FromSqlRaw` (без инъекции, но противоречит конвенции); `GetCard`/`ExportForCustomer` — `AsNoTracking()` + глобальный `UseLazyLoadingProxies()` без `Include(Customer)`.

Полные обоснования и привязка к строкам — в `/Users/anonymous/.cache/research/runs/514dc4/work/_answer.md`.