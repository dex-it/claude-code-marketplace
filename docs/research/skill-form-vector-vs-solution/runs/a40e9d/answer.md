Провёл ревью MR, ответ записан в `/Users/anonymous/.cache/research/runs/a40e9d/work/_answer.md`. Кратко, самое важное:

**Critical**
1. `Model.cs`/`OrderRepository.cs` не обновлены под миграцию — `Order.Category` удалён из БД (`Migrations/20260920_OrderCategories.cs`), но модель всё ещё его маппит → любой запрос к `Orders` упадёт после деплоя. Заодно нет entity для `Categories`/`OrderCategories`.
2. Та же миграция — нет data migration исторических значений `Category` в новые таблицы (тихая потеря данных).
3. `OrderQueries.GetProductBySku` — `SingleAsync` по `Sku`, хотя SKU уникален только в рамках склада (см. контекст MR) — упадёт на обычных данных.
4. `OrderAdmin.RecalcTotal` — сумма считается без учёта `OrderItem.Qty` (`Sum(prices[...])` вместо `price*qty`) — неверный итог заказа.
5. `OrderAdmin.OverdueReport` — грузит всю таблицу `Orders` через `repo.GetAllAsync()` и фильтрует `IsOverdue` в памяти.
6. `CatalogService.Search` — алиас `p` в шаблоне `FromSqlRaw`, но условия обращаются к `"Products"` — ломается всегда при заданном фильтре.
7. `OverdueNotifier` — `ShopDbContext` инжектирован напрямую в `BackgroundService` (singleton captures scoped).

**High**: `OrderAdmin.UpdateOrder` без concurrency token при параллельной правке операторами; `OrderQueries.LastShippedAt` — `!.Value` на `MaxAsync` без гарантии non-null; `OrderQueries.ExportForCustomer` — двойной `Include` без `AsSplitQuery` для клиентов с тысячами заказов; `CatalogService.Reserve` — `FOR UPDATE` без транзакции (гонка при резервировании остатка).

**Medium**: `GetCard` — лишний `AsSplitQuery` для одной сущности; `Reprice` — лишний `UpdateRange` для уже tracked сущностей (+ стоит рассмотреть `ExecuteUpdateAsync`); `RecalcTotal` — возможный `KeyNotFoundException` при удалённом товаре.