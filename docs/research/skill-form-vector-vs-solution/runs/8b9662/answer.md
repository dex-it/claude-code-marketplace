Ревью завершено, результат сохранён в `_answer.md`. Основные находки:

**Critical**
1. `CatalogService.Search` — условия фильтра ссылаются на `"Products"` после того, как таблице присвоен алиас `p` → PostgreSQL вернёт ошибку при любом фильтре.
2. `CatalogService.Reserve` — `SELECT ... FOR UPDATE` без явной транзакции: блокировка снимается до `SaveChangesAsync`, возможен overselling остатка при гонке.
3. `OverdueNotifier` — scoped `ShopDbContext` внедрён в singleton `BackgroundService` напрямую (нет `IServiceScopeFactory`) → падение на старте или captive dependency с бесконтрольным ростом ChangeTracker.
4. Миграция `OrderCategories` дропает `Orders.Category` без переноса данных в новые таблицы `Categories`/`OrderCategories` — потеря исторических данных.
5. Модель `Order`, `OrderEdit` и `OrderAdmin.UpdateOrder` не обновлены под новую схему — после миграции колонки `Category` нет, но EF продолжает её мапить → все запросы/сохранения `Order` начнут падать.
6. `OrderAdmin.RecalcTotal` суммирует цены без умножения на `Qty` — заниженный итог заказа.

**High**
7. `OrderQueries.GetProductBySku` — `SingleAsync` по SKU, который по модели не уникален (несколько складов) → исключение в штатном случае.
8. `OrderAdmin.UpdateOrder` — нет optimistic concurrency, хотя MR явно описывает одновременную правку заказов операторами → lost update.
9. `OrderQueries.ExportForCustomer` — два `Include` без `AsSplitQuery` → декартово произведение, критично при "тысячах заказов" у клиента.
10. `OrderQueries.LastShippedAt` — `last!.Value` кинет NRE, если у клиента нет отгруженных заказов.
11. `CatalogService.Reprice` — избыточный `UpdateRange` на уже отслеживаемых сущностях перезаписывает все колонки, включая устаревший `Stock`, что может затереть параллельный `Reserve`.

**Medium**
12. `OrderAdmin.OverdueReport`/`OrderRepository.GetAllAsync` — фильтрация просроченных заказов после загрузки всей таблицы в память.
13. `OverdueNotifier` — нет try/catch в цикле; необработанное исключение по умолчанию останавливает весь хост (.NET 8 `BackgroundServiceExceptionBehavior.StopHost`).

**Low**
14. Имя файла миграции использует только дату (8 цифр) вместо стандартного 14-значного timestamp — риск коллизии сортировки при нескольких миграциях в один день.