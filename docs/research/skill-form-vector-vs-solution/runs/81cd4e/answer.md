Провёл ревью и записал находки в `/Users/anonymous/.cache/research/runs/81cd4e/work/_answer.md`. Краткая сводка:

**Critical (7):** миграция дропает `Orders.Category`, но `Model.cs`/`OrderAdmin.UpdateOrder` продолжают его использовать — ломает всё приложение; отсутствует перенос исторических данных категорий в новые таблицы; `CatalogService.Reserve` — `FOR UPDATE` без транзакции (overselling); `CatalogService.Search` — несовпадение алиаса таблицы в динамическом SQL (метод падает при любом фильтре); `OrderAdmin.RecalcTotal` игнорирует `Qty` при пересчёте суммы; `OrderQueries.GetProductBySku` использует `SingleAsync` при заведомо неуникальном SKU (несколько складов); `OverdueNotifier` внедряет scoped `ShopDbContext` напрямую в singleton `BackgroundService`.

**High (4):** нет concurrency-токена в `OrderAdmin.UpdateOrder` при параллельной правке операторами; `OrderQueries.ExportForCustomer` не использует `AsSplitQuery` при двойном `Include` для клиентов с тысячами заказов (а `GetCard`, наоборот, использует его для одной записи); `OrderAdmin.OverdueReport` фильтрует все заказы в памяти вместо SQL; `OverdueNotifier` каждую минуту дублирует записи в `AuditLog` без дедупликации.

**Medium (3) и Low (2):** неэффективный `Reprice` (цикл + лишний `UpdateRange` вместо `ExecuteUpdateAsync`), отсутствие обработки ошибок в цикле воркера, возможный `KeyNotFoundException` в `RecalcTotal`, лишний `AsSplitQuery` на `GetCard`, cascade delete на FK к soft-deleted `Orders`.

Код не менялся, файлы вне рабочего каталога не читались, сборка/тесты не запускались.