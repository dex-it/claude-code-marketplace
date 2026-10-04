Провёл ревью MR !4127, файл с ответом записан в `_answer.md`. Ниже — тот же список находок.

## Critical

1. **`Migrations/20260920_OrderCategories.cs` (`Up`) + `Model.cs` (`Order.Category`) + `Services/OrderAdmin.cs` (`UpdateOrder`)** — миграция дропает колонку `Orders.Category`, но `Order` (не менялся в MR) по-прежнему её объявляет, и EF по конвенции продолжит проецировать это поле во всех запросах к `Orders`. После деплоя **любой** SELECT/UPDATE к Orders упадёт с `column "Category" does not exist`. Новые таблицы `Categories`/`OrderCategories` вообще никак не замаплены в `ShopDbContext` и нигде не используются — фича не реализована, а старый функционал сломан.

2. **`Migrations/20260920_OrderCategories.cs` (`Up`)** — нет переноса существующих значений `Orders.Category` в `Categories`/`OrderCategories` перед дропом колонки. Исторические данные о категориях заказов теряются безвозвратно, `Down()` их тоже не восстанавливает.

3. **`Services/OrderQueries.cs` (`GetProductBySku`)** — `SingleAsync(p => p.Sku == sku)` без фильтра по складу, а по модели SKU уникален только в рамках склада. Гарантированно бросит `InvalidOperationException`, как только SKU лежит на нескольких складах (обычный случай).

4. **`Services/OrderAdmin.cs` (`RecalcTotal`)** — `order.Items.Sum(i => prices[i.ProductId])` игнорирует `Qty`; сумма должна быть `price * qty`. Прямая финансовая ошибка при количестве > 1.

5. **`Services/CatalogService.cs` (`Search`)** — SQL строится как `FROM "Products" p WHERE ...`, но условия ссылаются на `"Products"."Category"/"Price"` вместо алиаса `p`. В PostgreSQL это `invalid reference to FROM-clause entry` — метод падает при любом непустом фильтре, т.е. именно в основном сценарии использования.

6. **`Services/CatalogService.cs` (`Reserve`)** — `FOR UPDATE` выполняется вне явной транзакции, поэтому блокировка строки снимается сразу после SELECT, до последующего `SaveChangesAsync`. Пессимистическая блокировка фактически не работает — возможен overselling остатка при параллельных резервированиях.

7. **`Workers/OverdueNotifier.cs` + `Program.cs`** — scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService` (captive dependency). В Development упадёт при старте (scope validation), в Production один и тот же `DbContext`/ChangeTracker живёт вечно и копит записи — утечка памяти и общая некорректность использования DbContext вне scope.

## High

8. **`Workers/OverdueNotifier.cs` (`ExecuteAsync`)** — нет try/catch вокруг цикла; любая транзиентная ошибка БД по умолчанию (`BackgroundServiceExceptionBehavior.StopHost`) остановит весь хост, а не только воркер.

9. **`Services/OrderAdmin.cs` (`UpdateOrder`)** — нет optimistic concurrency (rowversion/`xmin`), хотя в MR явно сказано, что заказ правят несколько операторов одновременно — classic lost update.

10. **`Services/OrderQueries.cs` (`ExportForCustomer`)** — `Include(Items).Include(Payments)` без `AsSplitQuery()` (в отличие от `GetCard`), при тысячах заказов на клиента даёт картезианский взрыв строк и деградацию по памяти/сети.

11. **`Services/OrderAdmin.cs` (`OverdueReport`) / `OrderRepository.GetAllAsync`** — тянет и трекает всю таблицу `Orders` в память и только потом фильтрует просрочку на клиенте, вместо фильтрации в БД.

## Medium

12. **`Services/OrderQueries.cs` (`LastShippedAt`)** — `MaxAsync` вернёт `null`, если у клиента нет отгруженных заказов; `last!.Value` бросит `InvalidOperationException`, `!` не спасает от рантайм-ошибки.

13. **`Services/OrderAdmin.cs` (`RecalcTotal`)** — `prices[i.ProductId]` без проверки наличия ключа — `KeyNotFoundException`, если товар позиции заказа удалён из каталога.

## Low

14. **`Services/CatalogService.cs` (`Reprice`)** — `factor` не валидируется (0/отрицательные значения дают некорректные цены).
15. **`Workers/OverdueNotifier.cs`** — дублирует логику просрочки вместо переиспользования `Order.IsOverdue`, риск рассинхронизации правил.
16. **`Migrations/20260920_OrderCategories.cs`** — нет уникального индекса на `Categories.Name` и индекса на `OrderCategories.CategoryId`.