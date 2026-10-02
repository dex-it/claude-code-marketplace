Провёл ревью MR — результат ниже и записан в `_answer.md`.

## Critical
1. **Migrations/20260920_OrderCategories.cs (`Up`) + Model.cs (`Order.Category`)** — миграция дропает колонку `Category`, но модель (не менялась в MR) всё ещё маппит `Order.Category` на неё → любой запрос/апдейт `Order` целиком (`OrderQueries.GetCard/ExportForCustomer`, `OrderRepository.GetAllAsync/GetAsync`, `OrderAdmin.UpdateOrder/RecalcTotal/OverdueReport`) упадёт с ошибкой «column does not exist».
2. **Migrations/20260920_OrderCategories.cs (`Up`)** — потеря данных: колонка `Category` дропается без переноса значений в новые `Categories`/`OrderCategories`.
3. **Services/OrderAdmin.cs → RecalcTotal** — сумма считается как `Sum(prices[ProductId])` без учёта `Qty`; занижает `Total` для любых позиций с количеством > 1.
4. **Services/CatalogService.cs → Reserve** — `FOR UPDATE` без явной транзакции: лок снимается сразу после SELECT (автокоммит), `SaveChangesAsync` идёт отдельной транзакцией → race condition/overselling остатка.
5. **Workers/OverdueNotifier.cs** — Scoped `ShopDbContext` внедряется напрямую в hosted service (singleton) → captive dependency: падение на старте либо один и тот же DbContext живёт вечно (не потокобезопасно, растущий change tracker).

## High
6. **OrderQueries.GetProductBySku** — `SingleAsync` по SKU, хотя SKU уникален только в пределах склада (по контексту модели) → упадёт при наличии SKU на нескольких складах.
7. **OrderQueries.ExportForCustomer** — два `Include` без `AsSplitQuery` (в отличие от соседнего `GetCard`) → декартово произведение для клиентов с тысячами заказов.
8. **OrderQueries.LastShippedAt** — `MaxAsync(ShippedAt)` может вернуть `null`, `last!.Value` бросит NRE, если у клиента нет отгруженных заказов.
9. **OrderAdmin.UpdateOrder** — нет оптимистической блокировки, хотя MR явно описывает параллельную правку заказа несколькими операторами → lost update.
10. **OrderAdmin.OverdueReport** — через `_repo.GetAllAsync()` грузит всю таблицу Orders в память, фильтрует в C# вместо БД.

## Medium
11. **CatalogService.Reprice** — лишний `UpdateRange` на уже отслеживаемых сущностях → помечает все колонки как Modified.
12. **OrderAdmin.RecalcTotal** — `prices[i.ProductId]` бросит `KeyNotFoundException`, если товар удалён из Products.
13. **OverdueNotifier.ExecuteAsync** — нет try/catch в цикле; одно исключение навсегда останавливает воркер.

## Low
14. **Migration** — нет отдельного индекса на `OrderCategories.CategoryId` для выборок «заказы по категории».