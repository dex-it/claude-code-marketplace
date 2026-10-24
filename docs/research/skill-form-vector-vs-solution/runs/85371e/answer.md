Провёл ревью MR !4127. Ниже — находки (файл / метод, суть дефекта, severity). Тот же текст записан в `work/_answer.md`.

**Critical**

1. **Migrations/20260920_OrderCategories.cs (`Up`/`Down`)** — `DropColumn("Category","Orders")` без переноса существующих значений в `Categories`/`OrderCategories`. Историческая категоризация заказов будет потеряна безвозвратно; `Down()` данные тоже не восстанавливает.
2. **Model.cs (`Order`) vs миграция** — после `DropColumn` свойство `Order.Category` всё ещё смаппировано на удалённую колонку, `DbSet`/навигация для новых таблиц не добавлены. Любой запрос к `Orders` упадёт с `column "Category" does not exist` — приложение не работает после применения миграции.
3. **Services/OrderAdmin.cs — UpdateOrder** — пишет `order.Category = edit.Category` в удаляемую этой же миграцией колонку.
4. **Services/OrderAdmin.cs — RecalcTotal** — `order.Items.Sum(i => prices[i.ProductId])` не умножает на `i.Qty`; при контексте «Price — цена за единицу, Qty — количество» сумма заказа считается неверно.
5. **Services/CatalogService.cs — Reserve** — `SELECT ... FOR UPDATE` через `FromSqlRaw` выполняется без явной транзакции, охватывающей и `SaveChangesAsync`. Блокировка снимается сразу после SELECT (отдельная неявная автокоммит-транзакция), т.е. `FOR UPDATE` не защищает от гонки — возможен oversell остатка при параллельных резервах.
6. **Workers/OverdueNotifier.cs** — `ShopDbContext` (scoped) внедрён напрямую в конструктор `BackgroundService` (регистрируется как singleton через `AddHostedService`). Это captive dependency: либо падение при валидации scope, либо один и тот же `DbContext` живёт весь цикл жизни приложения (не потокобезопасен, копит tracked-сущности). Нужен `IServiceScopeFactory` со scope на каждую итерацию.

**High**

7. **Services/OrderAdmin.cs — UpdateOrder** — нет optimistic concurrency (RowVersion/xmin), хотя MR прямо описывает параллельную правку заказа несколькими операторами → lost update.
8. **Services/OrderAdmin.cs — OverdueReport** — через `OrderRepository.GetAllAsync()` тянет всю таблицу `Orders` без фильтра и без `AsNoTracking`, фильтрует в памяти доменным методом `IsOverdue` (нетранслируемое условие после материализации).
9. **Services/OrderQueries.cs — ExportForCustomer** — два коллекционных `Include` (`Items`, `Payments`) без `AsSplitQuery()`: декартово произведение строк, критично при «тысячах заказов» у крупных клиентов (в отличие от соседнего `GetCard`, где `AsSplitQuery` есть).
10. **Services/OrderQueries.cs — GetProductBySku** — `SingleAsync` по `Sku`, хотя по модели SKU уникален только в рамках склада, а не глобально; упадёт при обычной ситуации — SKU на нескольких складах.
11. **Services/OrderQueries.cs — LastShippedAt** — `last!.Value` без проверки на null; `MaxAsync` вернёт null, если у клиента нет отгруженных заказов — падение в штатном сценарии.
12. **Services/CatalogService.cs — Search** — шаблон аліасит таблицу как `p`, но динамически собранные условия квалифицируют колонки как `"Products"."Category"`/`"Products"."Price"` — рассинхрон алиасов, SQL-ошибка при заданном фильтре.
13. **Services/CatalogService.cs — Reprice** — сущности уже трекаются (`ToListAsync` без `AsNoTracking`), но вызывается `UpdateRange`, что переводит в Modified все поля, а не только `Price`; в UPDATE уйдут все колонки со старым снимком — риск затереть параллельно изменённый `Stock` (например, из `Reserve`).

**Medium**

14. **Migrations/20260920_OrderCategories.cs** — `FK_OrderCategories_Categories` с `Cascade`: удаление категории молча каскадно снесёт связи заказов с ней; возможно, нужнее `Restrict`.