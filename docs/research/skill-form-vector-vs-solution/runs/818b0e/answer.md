Провёл ревью MR !4127 (без изменения кода/сборки), результат также записан в `_answer.md`.

## Critical
1. **Migrations/20260920_OrderCategories.cs (`Up`)** — дропает `Orders.Category`, но `Model.cs` всё ещё мапит `Order.Category` на эту колонку, а новые таблицы `Categories`/`OrderCategories` вообще не отражены в `ShopDbContext`. Ломает практически любой запрос к `Order` после наката.
2. **Migrations/20260920_OrderCategories.cs (`Up`)** — нет бэкфилла: существующие `Orders.Category` не переносятся в `Categories`/`OrderCategories` перед дропом колонки — потеря исторических данных.
3. **Workers/OverdueNotifier.cs** — scoped `ShopDbContext` внедряется в singleton `BackgroundService` напрямую через конструктор (нужен `IServiceScopeFactory`).
4. **Services/CatalogService.cs `Reserve`** — `FOR UPDATE` без явной границы транзакции: лок снимается до `SaveChangesAsync`, возможен oversell при гонке.
5. **Services/OrderAdmin.cs `RecalcTotal`** — сумма считается без учёта `OrderItem.Qty` (`prices[i.ProductId]` вместо `prices[i.ProductId] * i.Qty`).

## High
6. **OrderQueries.cs `GetProductBySku`** — `SingleAsync` по `Sku`, который не уникален глобально (уникален только в рамках склада).
7. **OrderQueries.cs `LastShippedAt`** — `last!.Value` без проверки на `null` (нет заказов/нет отгрузок → падение).
8. **OrderAdmin.cs `UpdateOrder`** — нет optimistic concurrency при параллельной правке заказа операторами (lost update).
9. **OrderQueries.cs `ExportForCustomer`** — два `Include` без `AsSplitQuery()` для клиентов с тысячами заказов — декартово произведение.
10. **OrderAdmin.cs `OverdueReport`** — грузит всю таблицу `Orders` (tracked, без фильтра) и фильтрует в памяти доменным методом.
11. **CatalogService.cs `Reprice`** — `UpdateRange` на уже отслеживаемых сущностях перезаписывает все столбцы, может затереть параллельные изменения (например, `Stock` из `Reserve`).

## Medium
12. **OrderQueries.cs `GetCard`** — `AsSplitQuery()` на выборке одной сущности: лишние round-trip'ы плюс риск несогласованного снэпшота между Items/Payments при параллельных правках.

## Low
13. **CatalogService.cs `Search`** — динамически собираемый `FromSqlRaw` вместо композиции LINQ `Where` (параметризовано, инъекции нет, но хрупко и избыточно).