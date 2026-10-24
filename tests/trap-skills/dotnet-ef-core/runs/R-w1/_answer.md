# Ревью MR !4127 (сервисы заказов и каталога для админки)

## Critical

1. **Migrations/20260920_OrderCategories.cs (`Up`) + Model.cs (`Order`) — модель не обновлена под миграцию, данные не перенесены.**
   Миграция делает `mb.DropColumn("Category", "Orders")` и создаёт `Categories`/`OrderCategories`, но:
   - `Model.cs` по-прежнему объявляет `Order.Category` (свойство маппится на колонку по конвенции), и в `ModelBuilder` нет ни `Ignore()`, ни новых сущностей `Category`/`OrderCategories`, ни `DbSet` для них. После применения миграции EF продолжит генерировать `SELECT`/`INSERT`/`UPDATE` с колонкой `"Category"`, которой в БД больше нет — упадёт **любой** запрос к `Orders`, в частности `Services/OrderAdmin.cs::UpdateOrder` (`order.Category = edit.Category`) и вообще всё, что читает заказы (`OrderQueries`, `OrderRepository`).
   - Нет шага переноса существующих строковых значений `Orders.Category` в новые таблицы `Categories`/`OrderCategories` перед `DropColumn` — исторические данные о категории заказа будут безвозвратно потеряны.
   Функциональность по факту не реализована на уровне кода (только схема), это блокер.

2. **Migrations/20260920_OrderCategories.cs — небезопасная для прод-выкладки миграция (deploy-order).**
   `DropColumn` в одном шаге вместе с созданием новых таблиц — классический breaking change для rolling deployment: если миграция применяется раньше, чем все инстансы приложения обновлены на новую версию кода, старые (ещё работающие) инстансы, которые ссылаются на `Orders.Category`, немедленно начнут падать на любой операции с заказами. По чек-листу «применение миграции на production» такие изменения нужно разносить на expand/contract (сначала добавить новые таблицы и мигрировать данные, второй релиз — убрать старую колонку).

3. **Workers/OverdueNotifier.cs (`OverdueNotifier`, конструктор) — Scoped `ShopDbContext` внедрён в Singleton hosted service.**
   `ShopDbContext` регистрируется через `AddDbContext` (Scoped по умолчанию), а `OverdueNotifier` регистрируется как `AddHostedService` (Singleton). Прямое внедрение `ShopDbContext` в конструктор `OverdueNotifier` — внедрение scoped-зависимости в singleton: при включённой валидации скоупов (по умолчанию в Development) приложение упадёт на старте с `InvalidOperationException: Cannot consume scoped service 'ShopDbContext' from singleton`; в проде же это даст «captive dependency» — один и тот же контекст живёт всё время работы приложения, что противоречит модели использования `DbContext` (не потокобезопасен, не предназначен жить дольше одного логического юнита работы). Нужно внедрять `IServiceScopeFactory`/`IServiceProvider` и создавать scope на каждой итерации.

4. **Services/CatalogService.cs::Reserve — `SELECT ... FOR UPDATE` без явной транзакции, блокировка не защищает от гонки.**
   `FromSqlRaw("... FOR UPDATE")` выполняется как отдельная команда без `BeginTransactionAsync`/`SaveChanges` в одной транзакции. В режиме автокоммита Npgsql блокировка строки снимается сразу по завершении этого `SELECT`, ещё до проверки `Stock < qty` и до `SaveChangesAsync()`. Два параллельных вызова `Reserve` для одного товара могут оба прочитать одинаковый остаток, оба пройти проверку и оба списать — оверселлинг остатка, ради защиты от которого `FOR UPDATE` и добавлялся. Нужно оборачивать чтение+проверку+`SaveChanges` в одну явную транзакцию.

5. **Services/OrderAdmin.cs::RecalcTotal — сумма заказа считается без учёта количества.**
   `order.Total = order.Items.Sum(i => prices[i.ProductId])` — суммируются цены за единицу товара без умножения на `i.Qty`. По контексту модели `Product.Price` — цена за единицу, `OrderItem.Qty` — количество, значит правильная формула `prices[i.ProductId] * i.Qty`. Сейчас пересчёт суммы даёт неверный (заниженный) `Total` для любой позиции с `Qty != 1` — это основная бизнес-функция сервиса, дефект критический.

6. **Services/CatalogService.cs::Search — алиас таблицы не совпадает с условиями WHERE, запрос падает при любом фильтре.**
   SQL строится как `SELECT * FROM "Products" p WHERE {condition}`, но условия ссылаются на `"Products"."Category"` / `"Products"."Price"` (полное имя таблицы), а не на алиас `p`. В PostgreSQL после присвоения алиасу таблице обращение к её исходному имени в этом же запросе запрещено: `ERROR: invalid reference to FROM-clause entry for table "Products"`. Метод сломан всегда, когда передан `category` или `minPrice` (то есть в основном сценарии использования, а не только когда оба фильтра `null`).

## High

7. **Services/OrderQueries.cs::GetProductBySku — `SingleAsync` упадёт для обычного случая нескольких складов.**
   По контексту модели один SKU лежит на нескольких складах (уникален только в рамках склада), значит `_db.Products.SingleAsync(p => p.Sku == sku)` бросит `InvalidOperationException: Sequence contains more than one element`, как только для SKU есть остатки на >1 складе — это штатная ситуация, а не край. Нужно либо возвращать список продуктов по SKU, либо фильтровать дополнительно по складу.

8. **Services/OrderQueries.cs::ExportForCustomer — нет `AsSplitQuery()` при двух коллекциях-инклюдах и «тысячах заказов» у клиента.**
   `Include(o => o.Items).Include(o => o.Payments)` без `AsSplitQuery()` даёт декартово произведение Items × Payments в одном SQL-запросе (в отличие от соседнего `GetCard`, где `AsSplitQuery()` есть). Для клиента с тысячами заказов, каждый из которых может иметь несколько позиций и платежей, это кратно раздувает объём передаваемых данных и время выполнения запроса.

9. **Services/OrderAdmin.cs::OverdueReport — полное вычитывание таблицы `Orders` в память вместо серверной фильтрации.**
   `_repo.GetAllAsync()` (`_db.Orders.ToListAsync()`, без `AsNoTracking`) грузит **все** заказы целиком (со всеми колонками, под трекингом изменений), а фильтрация `o.IsOverdue(now)` выполняется уже в памяти, поскольку `IsOverdue` — нетранслируемый C#-метод. Правильно — сформировать транслируемое условие (`ShippedAt == null && CreatedAt < cutoff`, как это уже сделано в `Workers/OverdueNotifier.cs`) и выполнить `Where(...).AsNoTracking()` на сервере. Сейчас отчёт по просроченным заказам стоимостно эквивалентен полному скану и загрузке таблицы Orders.

10. **Services/OrderAdmin.cs::UpdateOrder — нет контроля конкурентного доступа.**
    Согласно описанию MR несколько операторов правят один и тот же заказ одновременно, но `UpdateOrder` просто перезаписывает `Status`/`Category` без токена конкурентности (`RowVersion`/`xmin`) и без проверки, что заказ не был изменён между чтением и записью. Классический lost update: правки одного оператора молча затираются правками другого.

## Medium

11. **Services/OrderQueries.cs::LastShippedAt — падает, если у клиента нет отгруженных заказов.**
    `MaxAsync(o => o.ShippedAt)` возвращает `null`, если у клиента вообще нет заказов или ни один ещё не отгружен; `last!.Value` в этом случае бросает `InvalidOperationException` (Nullable object must have a value) вместо осмысленной обработки (например, `DateTime?` в сигнатуре или явное бизнес-исключение).

12. **Workers/OverdueNotifier.cs::ExecuteAsync — неограниченный рост `AuditLog` и отсутствие обработки ошибок.**
    Каждую минуту в лог безусловно добавляется новая запись `AuditLog` по **каждому** всё ещё просроченному заказу — без проверки, что запись по этому заказу уже создавалась. Пока заказ не отгружен, лог будет расти на одну строку в минуту на заказ бесконечно (шум/дубликаты вместо разового уведомления о переходе в просрочку). Дополнительно: весь цикл `while` не обёрнут в try/catch — любое временное исключение (например, сбой соединения с БД на `SaveChangesAsync`) уронит `ExecuteAsync` целиком, и воркер больше никогда не выполнится до перезапуска процесса.

13. **Migrations/20260920_OrderCategories.cs — нет индекса по `CategoryId` в `OrderCategories`.**
    Составной PK `(OrderId, CategoryId)` эффективен для поиска категорий по заказу, но не для обратного запроса «все заказы категории X» — такой запрос потребует полного скана таблицы связей. Стоит добавить отдельный индекс по `CategoryId`.

## Low

14. **Services/CatalogService.cs::Reprice — избыточный `_db.UpdateRange(products)`.**
    `products` уже получены из `_db` без `AsNoTracking` (то есть трекаются), и мутация `p.Price *= factor` уже будет подхвачена трекером изменений. Явный `UpdateRange` на уже отслеживаемых сущностях лишний и помечает все свойства как Modified (более широкий `UPDATE`, чем нужно).

15. **Services/OrderAdmin.cs::RecalcTotal — `prices[i.ProductId]` без защиты от отсутствующего товара.**
    Если товар из `OrderItem.ProductId` был удалён из `Products`, обращение к словарю по отсутствующему ключу бросит `KeyNotFoundException` вместо контролируемой обработки несогласованных ссылок.
