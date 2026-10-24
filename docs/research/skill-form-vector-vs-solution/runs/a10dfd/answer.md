Ревью завершено, результат записан в `_answer.md`. Основные находки:

**Critical**
1. `Migrations/20260920_OrderCategories.cs` — дроп `Orders.Category` без переноса данных в `Categories`/`OrderCategories`; `Model.cs` и `OrderAdmin.UpdateOrder` продолжают маппить/писать несуществующую колонку — после деплоя все запросы к `Orders` упадут, история категорий теряется безвозвратно.
2. `CatalogService.Reserve` — `FOR UPDATE` без явной транзакции: блокировка снимается сразу после `SELECT`, гонка при резервировании остатка (oversell).
3. `CatalogService.Search` — условия фильтра ссылаются на `"Products"`, хотя таблица заалиасена как `p`; при любом фильтре запрос падает с ошибкой Postgres.
4. `Workers/OverdueNotifier` — scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService`, живёт вечно в бесконечном цикле.

**High**
5. `OrderQueries.ExportForCustomer` — две коллекции в одном `Include` без `AsSplitQuery`, декартово произведение для клиентов с тысячами заказов.
6. `OrderQueries.GetProductBySku` — `SingleAsync` по SKU, который не уникален (несколько складов).
7. `OrderQueries.LastShippedAt` — `!.Value` на nullable без проверки, падение при отсутствии отгрузок.
8. `OrderAdmin.UpdateOrder` — нет concurrency-контроля при параллельной правке несколькими операторами.
9. `OrderAdmin.RecalcTotal` — сумма считается без умножения на `Qty` (финансовый баг).
10. `OrderAdmin.OverdueReport` — репозиторий тянет всю таблицу, фильтр по `IsOverdue` после материализации.

**Medium**
11. `CatalogService.Reprice` — лишний `UpdateRange` на уже отслеживаемых сущностях, риск затереть конкурентно изменённый `Stock`.
12. Каскадный FK `OrderCategories → Orders` при soft-delete родителя.

**Low**
13. Отсутствие индекса по `CategoryId` в `OrderCategories`.