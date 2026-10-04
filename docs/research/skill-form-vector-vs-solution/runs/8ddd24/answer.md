Ревью готово, результат записан в `_answer.md`. Основные находки:

**Critical**
- `Migrations/20260920_OrderCategories.cs` (`Up`) — дропает `Orders.Category` без data-migration и без синхронного изменения `Order` в `Model.cs`; после миграции обычные запросы к `Orders` будут падать (`column "Category" does not exist`), плюс безвозвратная потеря исторических категорий.
- `Services/CatalogService.cs: Search` — таблица аліасится как `p`, а динамические условия ссылаются на `"Products".Column` — рантайм-ошибка Postgres при любом фильтре.
- `Services/CatalogService.cs: Reserve` — `FOR UPDATE` без явной транзакции, блокировка снимается сразу после SELECT → race condition/overselling остатка.
- `Services/OrderAdmin.cs: RecalcTotal` — сумма считается без учёта `OrderItem.Qty` (только цена), занижает Total; плюс риск `KeyNotFoundException` на удалённом товаре.
- `Workers/OverdueNotifier.cs` (конструктор) — Scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService`: падение на старте при включённой валидации скоупов и гарантированная утечка Change Tracker в Production.

**High**
- `OrderQueries.GetProductBySku` — `SingleAsync` на SKU, который по модели не уникален (несколько складов).
- `OrderQueries.LastShippedAt` — `MaxAsync` + `.Value` падает, если у клиента нет отгруженных заказов.
- `OrderQueries.ExportForCustomer` — два `Include` без `AsSplitQuery` при тысячах заказов на клиента — cartesian explosion.
- `OrderAdmin.UpdateOrder` — нет concurrency-токена при заявленном параллельном редактировании операторами.
- `OrderAdmin.OverdueReport` — фильтрация в памяти после `GetAllAsync()` всей таблицы Orders.
- `OverdueNotifier.ExecuteAsync` — нет try/catch, любое исключение останавливает весь хост.

**Medium/Low**
- `CatalogService.Reprice` — bulk-update через цикл вместо `ExecuteUpdateAsync` + лишний `UpdateRange` на уже отслеживаемых сущностях.
- `OrderQueries.GetCard` — избыточный `AsSplitQuery` для single-entity запроса.