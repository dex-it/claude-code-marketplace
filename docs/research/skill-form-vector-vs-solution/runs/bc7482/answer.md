Ревью завершено, результат записан в `_answer.md`. Основные находки:

**Critical**
1. `Migrations/20260920_OrderCategories.cs` — дропается колонка `Orders.Category`, но `Model.cs` всё ещё её маппит (`OrderAdmin.UpdateOrder` пишет в неё) — любой запрос к `Orders` упадёт после деплоя.
2. Та же миграция — нет data migration существующих категорий в новые таблицы, историческая данные теряются.
3. `OrderAdmin.RecalcTotal` — сумма считается без умножения на `Qty` (только цена за единицу).
4. `CatalogService.Reserve` — `FOR UPDATE` без транзакции, блокировка снимается сразу, возможен overselling.
5. `CatalogService.Search` — несовпадение алиасов в `FromSqlRaw` (`Products` vs `p`), падает при любом фильтре.
6. `OrderAdmin.OverdueReport` — полная выгрузка `Orders` и фильтр в памяти вместо `Where` в SQL.
7. `OverdueNotifier` + `Program.cs` — Scoped `ShopDbContext` инжектится напрямую в Singleton `BackgroundService`.

**High**
8. `OrderQueries.GetProductBySku` — `SingleAsync` по неуникальному `Sku` (уникален только в рамках склада).
9. `OrderQueries.LastShippedAt` — `!.Value` после `MaxAsync` по nullable-колонке без фильтра null.
10. `OrderQueries.ExportForCustomer` — два `Include` без `AsSplitQuery` при тысячах заказов клиента.
11. `OrderAdmin.UpdateOrder` — нет concurrency token при явно заявленной конкурентной правке операторами.

**Medium**
12. `CatalogService.Reprice` — лишний `UpdateRange` на уже отслеживаемых сущностях.

**Low**
13. `OrderQueries.GetCard` — `AsSplitQuery` для запроса единичной сущности.