# Ревью MR !4127 (сервисы заказов и каталога для админки)

## 1. Migrations/20260920_OrderCategories.cs (`Up`) — потеря исторических данных при выносе категорий
Миграция создаёт `Categories` + `OrderCategories` и **сразу же** `DropColumn("Category", "Orders")`, но нет ни одного `INSERT INTO`/`UPDATE`, который перенёс бы существующие строковые значения `Orders.Category` в новые таблицы. После деплоя вся историческая привязка заказов к категориям исчезает безвозвратно — данные не видны новому коду и не восстановимы (нет бэкапа значения).
Это прямое совпадение с пунктом skill «Схемная миграция без data migration для исторических данных»: DDL создаёт структуру, но данные из старой колонки не перенесены.
**Severity: critical**

## 2. Model.cs (`Order.Category`) vs Migrations/20260920_OrderCategories.cs — модель не синхронизирована со схемой
`Order` по-прежнему содержит `public string Category`, для него нет `[NotMapped]`/fluent-игнора, и по конвенции EF ожидает колонку `Category` в таблице `Orders`. Миграция эту колонку дропает. Также нигде не заведены entity `Category`/`OrderCategories` и DbSet/конфигурация many-to-many в `OnModelCreating` — новые таблицы вообще не отражены в модели, то есть приложение не может ими пользоваться.
Следствие: **любой** запрос к `Order` (GetCard, ExportForCustomer, UpdateOrder, RecalcTotal, OverdueReport, OverdueNotifier, OrderRepository) начнёт падать в рантайме с ошибкой Postgres «column "Category" does not exist» — приложение полностью неработоспособно после наката миграции.
Также `Services/OrderAdmin.cs: UpdateOrder` продолжает писать `order.Category = edit.Category` — прямое использование колонки, которой больше нет.
**Severity: critical**

## 3. Services/CatalogService.cs: `Reserve` — `FOR UPDATE` без транзакции, race condition на остатке
```
var product = await _db.Products.FromSqlRaw("... FOR UPDATE", productId).SingleAsync();
if (product.Stock < qty) return false;
product.Stock -= qty;
await _db.SaveChangesAsync();
```
`FOR UPDATE` выполняется отдельной командой вне явной транзакции (`BeginTransactionAsync` не вызывается), поэтому блокировка строки снимается сразу после SELECT — ещё до `SaveChangesAsync`. Два параллельных вызова `Reserve` для одного `productId` оба читают одинаковый `Stock`, оба проходят проверку и оба независимо уменьшают остаток — классический overselling. Это ровно anti-pattern из skill «Пессимистичная блокировка без транзакции».
**Severity: critical**

## 4. Services/CatalogService.cs: `Search` — несоответствие алиасов в динамическом FromSqlRaw
Шаблон: `"SELECT * FROM \"Products\" p WHERE {0}"` (алиас `p`), а условия строятся как `"\"Products\".\"Category\" = @p..."` / `"\"Products\".\"Price\" >= @p..."` — используется имя таблицы вместо алиаса `p`. Postgres бросит `missing FROM-clause entry for table "Products"` при вызове с любым непустым `category`/`minPrice` — то есть при любом реальном использовании фильтра (единственный сценарий без ошибки — оба параметра `null`, тогда WHERE остаётся `TRUE`). Это буквально пример из skill «Несоответствие алиасов в динамически собираемом FromSqlRaw».
**Severity: critical**

## 5. Services/OrderQueries.cs: `GetProductBySku` — `SingleAsync` по неуникальному условию
```
_db.Products.AsNoTracking().SingleAsync(p => p.Sku == sku);
```
По контексту MR один SKU лежит на нескольких складах (уникален только в рамках склада). `SingleAsync` без учёта склада бросит `InvalidOperationException` при ≥2 строках — то есть при каждом обращении к SKU, который есть на нескольких складах (обычный случай, не край). Совпадает с пунктом skill «Single() на запросе без уникального ограничения».
**Severity: critical**

## 6. Services/OrderQueries.cs: `LastShippedAt` — null-forgiving на nullable-агрегате без фильтра
```
var last = await _db.Orders.Where(o => o.CustomerId == customerId).MaxAsync(o => o.ShippedAt);
return last!.Value;
```
`ShippedAt` — nullable; `MAX` в SQL игнорирует NULL, но если у клиента вообще нет отгруженных заказов (только что созданный клиент, все заказы ещё активны), `MAX` вернёт `NULL`, и `last!.Value` упадёт с `NullReferenceException`. Ровно anti-pattern skill «Null-forgiving operator без WHERE-фильтра на nullable-колонке».
**Severity: high**

## 7. Services/OrderAdmin.cs: `UpdateOrder` — нет ConcurrencyToken при явно заявленном конкурентном доступе
MR прямо указывает: «в админке несколько операторов правят заказы одновременно». `UpdateOrder` читает заказ, меняет поля и сохраняет без какого-либо concurrency-токена (`[Timestamp]`/`UseXminAsConcurrencyToken()` нигде не настроены в `Model.cs`). Второй оператор молча перезатирает правки первого без исключения — classic last-write-wins, ровно то, от чего предостерегает skill.
**Severity: high**

## 8. Services/OrderAdmin.cs: `RecalcTotal` — сумма считается без учёта количества
```
order.Total = order.Items.Sum(i => prices[i.ProductId]);
```
По контексту MR `Product.Price` — цена за единицу, `OrderItem.Qty` — количество. Сумма должна быть `i.Qty * prices[i.ProductId]`, а не просто цена за штуку. Для любого `Qty != 1` итоговая сумма заказа занижена — финансовый баг в самой сути метода «пересчёт суммы заказа».
**Severity: critical**

## 9. Services/OrderAdmin.cs: `OverdueReport` — полная материализация таблицы и фильтрация в памяти
```
var all = await _repo.GetAllAsync();          // _db.Orders.ToListAsync() — вся таблица
return all.Where(o => o.IsOverdue(now)).Select(o => o.Id).ToList();
```
`IsOverdue` — метод на entity, который EF всё равно не транслирует в SQL, но проблема глубже: репозиторий отдаёт `List<Order>` (все столбцы, все заказы), а бизнес-фильтр применяется после материализации. Для отчёта по просроченным заказам по всей таблице — это ровно два пункта чек-листа skill сразу: «Фильтр в памяти после материализации» и «Репозиторий материализует вместо IQueryable». На проде это будет тянуть по сети всю таблицу `Orders` каждый вызов отчёта.
**Severity: high**

## 10. Services/OrderQueries.cs: `ExportForCustomer` — cartesian explosion без `AsSplitQuery`
```
_db.Orders.Where(o => o.CustomerId == customerId)
    .Include(o => o.Items).Include(o => o.Payments)
    .AsNoTracking().ToListAsync();
```
MR прямо предупреждает: «у крупных клиентов тысячи заказов». Два `Include` коллекций без `AsSplitQuery` на множестве заказов — ровно «Плохо»-пример skill (cartesian explosion): для тысяч заказов с items/payments один JOIN-запрос может раздуться до огромного числа строк вместо N+M+K. Нужен `AsSplitQuery()`.
**Severity: high**

## 11. Workers/OverdueNotifier.cs — Scoped DbContext инжектирован в Singleton BackgroundService
`OverdueNotifier : BackgroundService` регистрируется через `AddHostedService` (резолвится как singleton), и получает `ShopDbContext` напрямую через конструктор, при этом `ShopDbContext` зарегистрирован через `AddDbContext` (Scoped по умолчанию, см. `Program.cs`). Это ровно anti-pattern skill «DbContext в BackgroundService»: при включённой валидации scope (стандартно в Development) приложение не стартует с `InvalidOperationException: Cannot consume scoped service ... from singleton`; в проде без валидации получится один и тот же `DbContext` на весь жизненный цикл приложения — Change Tracker бесконечно растёт (каждый `AuditLogs.Add` в цикле остаётся в трекере), плюс `DbContext` не thread-safe при любом параллельном доступе. Нужно внедрять `IServiceScopeFactory` и создавать `CreateScope()` на каждой итерации.
**Severity: critical**

## 12. Services/OrderQueries.cs: `GetCard` — `AsSplitQuery` для одной сущности
```
_db.Orders.Include(o => o.Items).Include(o => o.Payments)
    .AsSplitQuery().AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId);
```
Выборка одного заказа по `Id` — это как раз обратный кейс из skill «AsSplitQuery для single entity»: лишний round-trip к БД не окупается для одной строки, один JOIN эффективнее. Стоит убрать `AsSplitQuery()`.
**Severity: low**

## 13. Services/CatalogService.cs: `Reprice` — цикл + `SaveChanges` вместо `ExecuteUpdate`, лишний `UpdateRange`
```
var products = await _db.Products.Where(p => p.Category == category).ToListAsync();
foreach (var p in products) p.Price *= factor;
_db.UpdateRange(products);
await _db.SaveChangesAsync();
```
Два наложившихся anti-pattern'а из skill: (а) переоценка целой категории через загрузку всех сущностей в память + цикл вместо `ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * factor))`; (б) `products` уже отслеживаются трекером (загружены без `AsNoTracking`), поэтому `UpdateRange` здесь избыточен и вреден — помечает Modified вообще все свойства, порождая UPDATE по всем колонкам вместо только `Price`.
**Severity: medium**

## 14. Program.cs — `UseLazyLoadingProxies()` включён глобально при сервисном слое с ручным контролем запросов
Весь новый слой (`OrderQueries`/`OrderAdmin`/`CatalogService`) явно использует `Include`/`AsNoTracking`, но на уровне `DbContext` включена ленивая загрузка через `UseLazyLoadingProxies()`. Это оставляет скрытый риск N+1 в любом коде, который обратится к непрогруженной навигации (например, `Customer` при `AsNoTracking()`-выборках в `OrderQueries`, где ленивая подгрузка на detached-сущностях ненадёжна и может бросать исключение). Стоит явно решить: либо убрать proxy-прокси в пользу полностью explicit-loading архитектуры (раз новый код идёт по этому пути), либо задокументировать почему оставлено.
**Severity: low**

---

### Итог по критичности
- **critical**: #1, #2, #3, #4, #5, #8, #11
- **high**: #6, #7, #9, #10
- **medium**: #13
- **low**: #12, #14

Мержить до правки миграции/модели (#1, #2), конкурентного `Reserve` (#3), `Search` (#4), `GetProductBySku` (#5), `RecalcTotal` (#8) и `OverdueNotifier` (#11) нельзя — это гарантированные падения/потеря денег/потеря данных.
