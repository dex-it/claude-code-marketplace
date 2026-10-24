Провёл ревью MR !4127, результат записан в `_answer.md`. Ключевые находки:

**Critical**
- `Migrations/20260920_OrderCategories.cs` — миграция дропает `Orders.Category`, а `Model.cs` не обновлён (нет сущности `Category`/join-навигации, старое свойство `Category` смэплено на несуществующую колонку) → любые операции с `Order` упадут; данные категорий теряются без миграции в новую схему (и обратно при `Down()`).
- `OrderAdmin.RecalcTotal` — сумма заказа считается без учёта `OrderItem.Qty` (финансовая ошибка).
- `OrderAdmin.OverdueReport` — грузит всю таблицу `Orders` через репозиторий и фильтрует в памяти вместо переводимого SQL-условия.
- `CatalogService.Reserve` — `FOR UPDATE` без явной транзакции: блокировка снимается сразу после `SELECT`, гонка при резерве остатка.
- `Workers/OverdueNotifier` + `Program.cs` — Scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService` (captive dependency), нужен `IServiceScopeFactory` со scope на каждую итерацию.

**High**
- `OrderAdmin.UpdateOrder` — нет optimistic concurrency при явно заявленной одновременной правке заказов операторами.
- `OrderQueries.ExportForCustomer` — два `Include`-коллекции без `AsSplitQuery` при "тысячах заказов" у клиента → декартово произведение.
- `OrderQueries.GetProductBySku` — `SingleAsync` по `Sku`, хотя SKU не уникален (уникален только Sku+Warehouse).
- `OrderQueries.LastShippedAt` — `!` на результате `MaxAsync` без проверки на null → NRE при отсутствии отгрузок.
- `CatalogService.Reprice` — `UpdateRange` на уже отслеживаемых сущностях помечает все колонки как изменённые, рискуя затереть параллельно изменённый `Stock`.

Плюс medium/low находки (неоправданный `AsSplitQuery` в `GetCard`, несовместимость `AsNoTracking` с `UseLazyLoadingProxies`, хрупкость динамического `FromSqlRaw` в `Search`) — подробности в `_answer.md`.