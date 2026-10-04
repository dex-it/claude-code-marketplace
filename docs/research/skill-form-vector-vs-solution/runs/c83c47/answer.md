Провёл ревью MR !4127, результат записан в `_answer.md`. Основные находки:

**Critical**
1. `Migrations/20260920_OrderCategories.cs` + `Model.cs` — миграция дропает `Orders.Category`, но модель не обновлена → падает вообще всё, что трогает `Order` (включая `OrderAdmin.UpdateOrder`).
2. Та же миграция — нет шага переноса данных из `Orders.Category` в новые таблицы: историческая привязка к категориям теряется безвозвратно.
3. `CatalogService.Reserve` — `FOR UPDATE` без явной транзакции, охватывающей SELECT и `SaveChanges`: блокировка снимается раньше времени, возможен oversell остатка при гонке.
4. `OverdueNotifier` — `ShopDbContext` (Scoped) инжектится напрямую в конструктор `BackgroundService` (Singleton): падает на старте DI или живёт один и тот же контекст весь жизненный цикл воркера.

**High**
5. `OrderAdmin.UpdateOrder` — нет optimistic concurrency при явно заявленном параллельном редактировании операторами.
6. `OrderAdmin.RecalcTotal` — сумма заказа считается без учёта `Qty`.
7. `OrderAdmin.OverdueReport` — грузит всю таблицу `Orders` через `GetAllAsync()` и фильтрует в памяти вместо SQL.
8. `OrderQueries.GetProductBySku` — `SingleAsync` по SKU, который уникален только в рамках склада, а не глобально.
9. `OrderQueries.LastShippedAt` — `!` на `MaxAsync` без проверки null.
10. `OrderQueries.ExportForCustomer` — два `Include`-коллекции без `AsSplitQuery()` при тысячах заказов на клиента (декартово произведение), в отличие от соседнего `GetCard`.
11. `CatalogService.Search` — динамический `FromSqlRaw` использует алиас `p`, но условия ссылаются на `"Products"...` — невалидный SQL в Postgres при заданных фильтрах.

**Medium**
12. `OrderAdmin.RecalcTotal` — `ToDictionaryAsync` без `Select` тянет полные сущности `Product` ради двух полей.
13. `CatalogService.Reprice` — избыточный `UpdateRange` на уже отслеживаемых сущностях, помечает все колонки как изменённые.