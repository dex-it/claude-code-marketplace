Провёл ревью MR (Services/OrderQueries.cs, OrderAdmin.cs, CatalogService.cs, Workers/OverdueNotifier.cs, миграция, Program.cs). Результат ниже и сохранён в `_answer.md`.

## Critical
1. **Migrations/20260920_OrderCategories.cs `Up`** — дропает `Orders.Category` без переноса данных в новые `Categories`/`OrderCategories` → потеря категорий всех существующих заказов.
2. **Model.cs `Order.Category` + Services/OrderAdmin.cs `OrderEdit`/`UpdateOrder`** — модель и код продолжают использовать колонку `Category`, которой после миграции нет в БД; новые таблицы `Categories`/`OrderCategories` вообще не заведены в `ShopDbContext`. Любой запрос к `Orders` упадёт.
3. **Services/CatalogService.cs `Reserve`** — `SELECT ... FOR UPDATE` выполняется вне явной транзакции, блокировка снимается до проверки `Stock`/`SaveChangesAsync`; при параллельных вызовах возможен оверселлинг остатка.
4. **Services/OrderAdmin.cs `RecalcTotal`** — суммируются только `Product.Price` без умножения на `OrderItem.Qty` → неверная сумма заказа для любой позиции с `Qty != 1`; также падает при удалённом продукте (`KeyNotFoundException`).
5. **Services/OrderQueries.cs `GetProductBySku`** — `SingleAsync` по SKU, хотя SKU уникален только в рамках склада, а не глобально; для SKU на нескольких складах (штатный случай) — исключение.
6. **Workers/OverdueNotifier.cs + Program.cs** — Scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService`: падение при валидации скоупов либо один "вечный" контекст на весь жизненный цикл приложения.

## High
7. **OrderAdmin.UpdateOrder** — нет оптимистичной блокировки, хотя MR явно говорит про параллельную правку заказов операторами — lost update.
8. **OrderQueries.ExportForCustomer** — `Include(Items).Include(Payments)` без `AsSplitQuery()` при "тысячах заказов" клиента → декартово произведение и раздувание выборки; нет пагинации.
9. **OrderAdmin.OverdueReport** — грузит всю таблицу `Orders` в память и фильтрует на клиенте вместо SQL-фильтра (как в `OverdueNotifier`).

## Medium
10. **OrderQueries.LastShippedAt** — `MaxAsync` вернёт `null`, если отгрузок не было; `last!.Value` бросает исключение в рантайме.
11. **OverdueNotifier.ExecuteAsync** — каждую минуту повторно пишет `AuditLog` по всё ещё просроченным заказам без дедупликации — неограниченный рост журнала.
12. **OverdueReport vs OverdueNotifier** — правило "3 дня" продублировано с разной обработкой `DateTimeKind`, риск расхождения результатов.

## Low
13. **CatalogService.Reprice** — нет валидации `factor`; лишний `UpdateRange` на уже отслеживаемых сущностях.
14. **CatalogService.Search** — избыточно сложный ручной raw SQL для простого фильтра (инъекции нет, но паттерн хрупкий).
15. **Миграция** — нет уникальности на `Categories.Name` и индекса на `OrderCategories.CategoryId`.