Ревью проведено, результат записан в `_answer.md`. Основные находки:

**Critical**
1. `Migrations/20260920_OrderCategories.cs` (`Up`) + `Model.cs` — миграция дропает `Orders.Category`, а модель EF (не тронутая в MR) и `OrderAdmin.UpdateOrder` продолжают читать/писать это поле — после деплоя приложение упадёт на любом запросе к `Order`.
2. Там же — миграция схемы без переноса исторических данных `Orders.Category` в новые таблицы Categories/OrderCategories — потеря данных на проде.
3. `CatalogService.Reserve` — `FOR UPDATE` без явной транзакции: блокировка снимается до `SaveChangesAsync`, возможен oversell при гонке.
4. `OrderAdmin.RecalcTotal` — сумма считается без учёта `OrderItem.Qty` (только цена), итог заказа неверен.
5. `Workers/OverdueNotifier.cs` + `Program.cs` — Scoped `ShopDbContext` внедрён в singleton `BackgroundService` (captive dependency), контекст живёт вечно, ChangeTracker растёт бесконечно.

**High**
6. `OrderQueries.ExportForCustomer` — два `Include` без `AsSplitQuery` на списке заказов (у крупных клиентов — тысячи) → декартово произведение Items×Payments, взрывной рост данных.
7. `OrderQueries.GetProductBySku` — `SingleAsync` по SKU, который по домену уникален только в рамках склада, а не глобально.
8. `OrderAdmin.UpdateOrder` — нет optimistic concurrency при явно описанной параллельной правке заказов операторами.
9. `OrderAdmin.OverdueReport` / `OrderRepository.GetAllAsync` — вся таблица Orders материализуется с трекингом, фильтр по `IsOverdue` — после материализации.
10. `CatalogService.Reprice` — `UpdateRange` на уже отслеживаемых сущностях помечает все поля Modified, рискует затереть параллельно изменённый `Stock`.

**Medium**
11. `OrderQueries.LastShippedAt` — `null!` на результате `MaxAsync`, упадёт, если у клиента нет отгруженных заказов.

**Low**
12. `OrderQueries.GetCard`/`ExportForCustomer` — `AsNoTracking()` + virtual `Order.Customer` под `UseLazyLoadingProxies()` — ленивая загрузка недоступна для этих сущностей.