Ревью проведено, файлы не менялись. Ниже — найденные дефекты (полный текст также сохранён в `_answer.md`).

## Критично
1. **Migrations/20260920_OrderCategories.cs `Up` + Model.cs `Order.Category`** — миграция дропает колонку `Category`, но данные в новые `Categories`/`OrderCategories` не переносятся (потеря данных), а `Order.Category` в модели и `OrderAdmin.UpdateOrder` продолжают её использовать → после деплоя любой запрос к `Orders` падает («column does not exist»).
2. **Services/OrderQueries.cs `GetProductBySku`** — `SingleAsync` по одному SKU, хотя SKU уникален только в рамках склада, а не глобально → штатный крэш для товаров на нескольких складах.
3. **Services/OrderAdmin.cs `RecalcTotal`** — суммирует `Price` без умножения на `Qty`, итог заказа занижен для любого количества > 1 (тихая финансовая ошибка).
4. **Services/CatalogService.cs `Reserve`** — `FOR UPDATE` выполняется вне явной транзакции, коммитится (и снимает блокировку) до `SaveChangesAsync` → блокировка не защищает от гонки, возможен оверселлинг.
5. **Services/CatalogService.cs `Search`** — шаблон алиасит таблицу как `p`, а собираемые условия используют `"Products"` вместо алиаса → SQL-ошибка при любом непустом фильтре.

## High
6. **Services/OrderQueries.cs `ExportForCustomer`** — два `Include`-коллекции без `AsSplitQuery` при «тысячах заказов» у клиента — декартово произведение и деградация производительности.
7. **Services/OrderAdmin.cs `UpdateOrder`** — нет optimistic concurrency при явно описанной конкурентной правке одного заказа несколькими операторами — тихий last-write-wins.
8. **Services/OrderAdmin.cs `OverdueReport`** — через репозиторий материализуется вся таблица `Orders` (tracked, без проекции/AsNoTracking), фильтрация по `IsOverdue` — уже после материализации.
9. **Services/CatalogService.cs `Reprice`** — `UpdateRange` на уже трекаемых сущностях помечает все колонки как Modified, включая `Stock` → возможная потеря конкурентного изменения остатка (гонка с `Reserve`).
10. **Workers/OverdueNotifier.cs** — scoped `ShopDbContext` внедрён в конструктор singleton `BackgroundService`: несоответствие времени жизни, риск падения при валидации скоупов и рост Change Tracker на весь срок жизни процесса.

## Medium
11. **Services/OrderQueries.cs `LastShippedAt`** — `MaxAsync` может вернуть `null` (нет отгруженных/нет заказов), `last!.Value` бросит исключение без null-проверки.