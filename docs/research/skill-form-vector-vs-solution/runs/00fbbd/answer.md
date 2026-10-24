Провёл ревью всех изменённых файлов MR (`OrderQueries.cs`, `OrderAdmin.cs`, `CatalogService.cs`, `OverdueNotifier.cs`, миграция, `Program.cs`) против чек-листа. Результат записан в `_answer.md`. Ниже — тот же список.

## Найденные дефекты

**1. Workers/OverdueNotifier.ExecuteAsync** — critical
Scoped `ShopDbContext` внедрён в конструктор singleton `BackgroundService`. Либо падает на старте, либо один `DbContext` живёт весь жизненный цикл приложения — Change Tracker копит записи `AuditLog` из каждой итерации цикла (утечка памяти).

**2. CatalogService.Reserve** — critical
`FOR UPDATE` выполняется без явной транзакции — в autocommit-режиме блокировка снимается сразу после `SELECT`, до `SaveChangesAsync()`. Защита от гонки не работает → overselling при параллельных резервациях.

**3. OrderAdmin.RecalcTotal** — critical
`order.Total = order.Items.Sum(i => prices[i.ProductId])` — суммируются только цены, `Qty` игнорируется. Итог неверен для любого товара с количеством != 1.

**4. Migrations/20260920_OrderCategories.cs (+ Model.cs)** — critical
Колонка `Orders.Category` удаляется без переноса данных в новые `Categories`/`OrderCategories` (безвозвратная потеря данных). При этом `Model.cs` не обновлён, `Order.Category` и `OrderAdmin.UpdateOrder` продолжают писать в несуществующую колонку — все операции с `Order` после миграции начнут падать.

**5. CatalogService.Search** — critical
Таблица аліасирована как `p` в шаблоне, но условия ссылаются на `"Products".Column`, а не на алиас — PostgreSQL даст ошибку `missing FROM-clause entry` при любом непустом фильтре.

**6. OrderQueries.GetProductBySku** — high
`SingleAsync(p => p.Sku == sku)` — SKU не уникален в домене (один SKU на нескольких складах), гарантированно упадёт при наличии >1 склада с этим SKU.

**7. OrderQueries.ExportForCustomer** — high
Два `Include` (Items, Payments) без `AsSplitQuery()` — декартово произведение строк, особенно критично для «клиентов с тысячами заказов», как указано в MR.

**8. OrderQueries.LastShippedAt** — medium
`MaxAsync(...)` может вернуть `null` (нет заказов/нет отгрузок), `last!.Value` бросит `NullReferenceException`.

**9. OrderAdmin.UpdateOrder** — high
Нет optimistic concurrency (RowVersion/проверки), хотя MR явно описывает одновременную правку заказа несколькими операторами — тихий lost update.

**10. OrderAdmin.OverdueReport** — high
`_repo.GetAllAsync()` тянет всю таблицу заказов в память, фильтр просрочки применяется после материализации — не масштабируется, хотя в этом же MR (`OverdueNotifier`) та же логика уже корректно выражена в SQL.

**11. CatalogService.Reprice** — high
Продукты загружены уже отслеживаемыми, но вызывается `UpdateRange`, который метит все свойства как `Modified`, включая `Stock` — конкурентное изменение `Stock` через `Reserve` будет затёрто.