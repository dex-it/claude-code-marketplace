Провёл ревью MR. Результат записан в `_answer.md`, ниже — та же сводка.

## Critical

1. **Migrations/20260920_OrderCategories.cs + Model.cs (`Order.Category`) + Services/OrderAdmin.cs (`UpdateOrder`)** — миграция дропает `Orders.Category`, но модель и `OrderAdmin.UpdateOrder` продолжают читать/писать это поле. После наката любой SELECT из `Orders` упадёт («column Category does not exist»); плюс нет бэкафилла старых значений категории в новые таблицы — потеря данных.
2. **Services/OrderAdmin.cs, `RecalcTotal`** — сумма считается как `Sum(price)` без умножения на `Qty`. Итог заказа занижен для любой позиции с количеством > 1.
3. **Services/CatalogService.cs, `Reserve`** — `SELECT ... FOR UPDATE` выполняется без явной транзакции, охватывающей последующий `SaveChangesAsync`; блокировка снимается сразу после SELECT, гонка при параллельном резерве приводит к перепродаже остатка.
4. **Workers/OverdueNotifier.cs + Program.cs** — в singleton `BackgroundService` напрямую внедрён Scoped `ShopDbContext` (captive dependency): либо падение при старте с включённой валидацией scope, либо один и тот же DbContext живёт вечно внутри бесконечного цикла — утечка памяти и устаревшее состояние ChangeTracker.
5. **Services/OrderQueries.cs, `GetProductBySku`** — `SingleAsync(p => p.Sku == sku)` падает, если SKU есть на нескольких складах, а по модели это штатный случай (SKU уникален только в рамках склада).

## High

6. **Services/OrderQueries.cs, `ExportForCustomer`** — два `Include` без `AsSplitQuery()` дают декартово произведение строк; для клиентов с тысячами заказов (явно указано в MR) — риск деградации/OOM. Контраст с `GetCard`, где `AsSplitQuery()` есть.
7. **Services/OrderQueries.cs, `LastShippedAt`** — `MaxAsync` возвращает `null`, если у клиента нет отгруженных заказов; `last!.Value` даёт NRE в рантайме.
8. **Services/OrderAdmin.cs, `UpdateOrder`** — нет optimistic concurrency при явно заявленном сценарии одновременного редактирования заказа несколькими операторами; блокирующая перезапись обоих полей приводит к lost update.
9. **Services/CatalogService.cs, `Reprice`** — лишний `UpdateRange` на уже трекаемых сущностях помечает модифицированными все колонки (включая `Stock`), что может затереть конкурентное изменение остатка от `Reserve`.

## Medium

10. **Workers/OverdueNotifier.cs** — нет try/catch в цикле: любое временное исключение навсегда останавливает воркер.
11. **Workers/OverdueNotifier.cs** — нет дедупликации логов: просроченный заказ пишется в AuditLog каждую минуту бесконечно, неограниченный рост таблицы.
12. **Services/OrderAdmin.cs, `RecalcTotal`** — возможен `KeyNotFoundException`, если товар из `OrderItem` уже удалён из каталога.

## Low

13. **Services/CatalogService.cs, `Search`** — без фильтров возвращает весь каталог без пагинации.
14. **Migrations/20260920_OrderCategories.cs** — нет уникального индекса на `Categories.Name`, нет индекса по `OrderCategories.CategoryId`.
15. **Program.cs** — `UseLazyLoadingProxies()` включён глобально, но все новые методы используют `Include`+`AsNoTracking`; несогласованный паттерн с риском скрытых lazy-load обращений в остальном коде.