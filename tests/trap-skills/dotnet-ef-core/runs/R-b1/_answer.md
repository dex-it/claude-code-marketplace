# Ревью MR !4127 (сервисы заказов и каталога для админки)

## 1. Migrations/20260920_OrderCategories.cs (`Up`) — несовместимо с моделью `Order.Category`, потенциально ломает все запросы к заказам
**Severity: critical**

Миграция делает `mb.DropColumn("Category", "Orders")`, но `Model.cs` (по описанию MR — не менявшийся файл) по-прежнему объявляет `Order.Category` как обычное свойство, и `OnModelCreating` его не игнорирует и не перекладывает на новые таблицы `Categories`/`OrderCategories`. По конвенции EF Core это свойство маппится на столбец `Category` таблицы `Orders`. После применения миграции столбца в БД нет, а модель продолжает его ожидать — любой запрос, затрагивающий `Order` (буквально все: `OrderQueries.GetCard`, `ExportForCustomer`, `OrderAdmin.UpdateOrder`, `RecalcTotal`, `OverdueReport` через `OrderRepository`, `OverdueNotifier`), начнёт падать с ошибкой Postgres `column o.Category does not exist`. Кроме того, `OrderAdmin.UpdateOrder` (Services/OrderAdmin.cs) продолжает писать `order.Category = edit.Category` — в новую схему (many-to-many через `OrderCategories`) это никак не переносится, т.е. функциональность правки категории заказа из MR фактически не реализована после смены схемы.
Нужно либо обновить `Model.cs`/`OnModelCreating` под новую схему (навигация `Order.Categories` через `OrderCategories`) и переписать `OrderAdmin.UpdateOrder`, либо не удалять колонку в этом MR.

## 2. Migrations/20260920_OrderCategories.cs (`Up`) — потеря данных при переносе категорий
**Severity: critical**

`Up()` создаёт `Categories`/`OrderCategories` и тут же дропает `Orders.Category`, не выполняя перенос существующих значений (нет `INSERT INTO "Categories" ... SELECT DISTINCT "Category" FROM "Orders"`, нет заполнения `OrderCategories`). Все текущие категории заказов в проде будут безвозвратно потеряны в момент миграции. `Down()` тоже не восстанавливает данные — просто создаёт пустую колонку.

## 3. Services/CatalogService.cs → `Reserve` — `FOR UPDATE` без транзакции не даёт реальной блокировки
**Severity: critical**

```csharp
var product = await _db.Products
    .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId)
    .SingleAsync();
if (product.Stock < qty) return false;
product.Stock -= qty;
await _db.SaveChangesAsync();
```
`SELECT ... FOR UPDATE` выполняется вне явной транзакции, поэтому Npgsql выполняет его в режиме autocommit: неявная транзакция коммитится сразу после `SELECT`, блокировка строки снимается ещё до проверки `Stock < qty` и до `SaveChangesAsync`. То есть `FOR UPDATE` здесь ничего не блокирует — при параллельных вызовах `Reserve` для одного и того же товара оба запроса могут прочитать одинаковый `Stock`, оба пройти проверку и оба списать qty — overselling остатка (ровно то, для чего задумывался «резерв остатка» в MR). Нужно оборачивать `SELECT ... FOR UPDATE` + запись в явную транзакцию (`_db.Database.BeginTransactionAsync()`) и коммитить её вместе с `SaveChangesAsync`.

## 4. Services/OrderAdmin.cs → `RecalcTotal` — сумма считается без учёта количества
**Severity: critical**

```csharp
order.Total = order.Items.Sum(i => prices[i.ProductId]);
```
По контексту модели `Product.Price` — цена за единицу, `OrderItem.Qty` — количество. Формула должна быть `i.Qty * prices[i.ProductId]`, а не просто цена товара. Сейчас для любого товара с `Qty != 1` итоговая сумма заказа считается неверно (заниженной при Qty>1). Это прямая денежная ошибка в пересчёте суммы заказа.

Дополнительно: если для какого-то `OrderItem.ProductId` товар отсутствует в выборке `prices` (например, товар удалён), обращение `prices[i.ProductId]` бросит `KeyNotFoundException` — стоит обрабатывать отсутствующие ключи явно.

## 5. Services/OrderQueries.cs → `GetProductBySku` — `SingleAsync` несовместим с моделью данных
**Severity: critical**

```csharp
public Task<Product> GetProductBySku(string sku) =>
    _db.Products.AsNoTracking().SingleAsync(p => p.Sku == sku);
```
По условиям MR один и тот же SKU может лежать на нескольких складах (уникален только в рамках склада). `SingleAsync` требует ровно одну строку и бросает исключение, если по SKU найдено больше одной записи `Product` — то есть метод будет падать для любого SKU, представленного более чем на одном складе, что по описанию модели является нормальной, ожидаемой ситуацией, а не редким крайним случаем.

## 6. Workers/OverdueNotifier.cs + Program.cs — Scoped `ShopDbContext` внедрён в singleton hosted service
**Severity: critical**

`ShopDbContext` регистрируется через `AddDbContext` (Scoped по умолчанию), а `OverdueNotifier` регистрируется через `AddHostedService` (создаётся и живёт как singleton). Конструктор `OverdueNotifier(ShopDbContext db)` получает scoped-зависимость напрямую в singleton:
- при включённой валидации скоупов (типично для Development при `WebApplication.CreateBuilder`) приложение упадёт при старте с `InvalidOperationException: Cannot consume scoped service ... from singleton`;
- даже если валидация выключена, один и тот же экземпляр `DbContext` будет жить и использоваться всё время работы приложения: запросы в `ExecuteAsync` не используют `AsNoTracking`, поэтому Change Tracker будет бесконечно копить отслеживаемые `Order`-сущности на каждой итерации цикла (раз в минуту) — утечка памяти, а сам `DbContext` не потокобезопасен и не предназначен для настолько долгого разделяемого использования.
Нужно внедрять `IServiceScopeFactory`/`IDbContextFactory<ShopDbContext>` и создавать новый scope/контекст на каждую итерацию `while`.

## 7. Services/OrderQueries.cs → `LastShippedAt` — `NullReferenceException`, если нет отгруженных заказов
**Severity: high**

```csharp
var last = await _db.Orders.Where(o => o.CustomerId == customerId).MaxAsync(o => o.ShippedAt);
return last!.Value;
```
`ShippedAt` — `DateTime?`. `MaxAsync` по nullable-полю возвращает `null`, если у клиента вообще нет заказов, либо если ни один из них ещё не отгружен (`ShippedAt == null` у всех) — это совершенно обычная ситуация для «даты последней отгрузки клиента». `last!.Value` в этом случае бросит `NullReferenceException` (null-forgiving только гасит предупреждение компилятора, не защищает во время выполнения). Нужно возвращать `DateTime?` наружу или явно обрабатывать «нет отгрузок».

## 8. Services/OrderQueries.cs → `ExportForCustomer` — нет `AsSplitQuery`, декартово произведение на выгрузке
**Severity: high**

```csharp
_db.Orders.Where(o => o.CustomerId == customerId)
    .Include(o => o.Items)
    .Include(o => o.Payments)
    .AsNoTracking()
    .ToListAsync();
```
Два `Include` для коллекций (`Items`, `Payments`) без `AsSplitQuery()` дают один SQL с двумя JOIN — при наличии M позиций и N платежей на заказ EF Core вернёт M×N строк на заказ, которые затем ещё нужно передать по сети и десериализовать. Соседний метод `GetCard` в этом же файле корректно использует `AsSplitQuery()` для точно такого же паттерна Include, а здесь — нет, хотя именно `ExportForCustomer` в описании MR специально помечен как «у крупных клиентов тысячи заказов». Для больших клиентов это приведёт к очень тяжёлым запросам/трафику.

## 9. OrderRepository.cs → `GetAllAsync`, используется в Services/OrderAdmin.cs → `OverdueReport`
**Severity: medium**

```csharp
public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
...
var all = await _repo.GetAllAsync();
return all.Where(o => o.IsOverdue(now)).Select(o => o.Id).ToList();
```
Отчёт по просроченным заказам вычитывает в память **всю** таблицу `Orders` (без фильтра по дате, без `AsNoTracking`) и только потом фильтрует на клиенте. С учётом отмеченного в MR масштаба (клиенты с тысячами заказов) это дорогой full scan и лишняя нагрузка на Change Tracker при каждом вызове отчёта. Фильтрацию по `CreatedAt`/`ShippedAt` нужно делать на уровне SQL (как это сделано в `OverdueNotifier`), а не тащить все заказы в память.

## 10. Services/OrderAdmin.cs → `UpdateOrder` — нет контроля конкурентности при параллельной правке
**Severity: medium**

MR прямо описывает сценарий «в админке несколько операторов правят заказы одновременно», но `UpdateOrder` делает простое read-modify-write без concurrency token (нет `RowVersion`/`xmin` проверки в `Order`, нет проверки конфликтов):
```csharp
var order = await _db.Orders.FirstAsync(o => o.Id == edit.Id);
order.Status = edit.Status;
order.Category = edit.Category;
await _db.SaveChangesAsync();
```
При одновременной правке одного заказа двумя операторами один из них молча перезатрёт изменения другого (lost update), никакого сигнала о конфликте не будет. Стоит добавить optimistic concurrency (concurrency token) и обрабатывать `DbUpdateConcurrencyException`.

## 11. Services/CatalogService.cs → `Reprice` — лишний вызов и отсутствие валидации
**Severity: low**

`_db.UpdateRange(products)` избыточен: сущности уже отслеживаются (получены без `AsNoTracking`), Change Tracker и так увидит изменение `Price` при `SaveChangesAsync`. Не критично, но лишний код. Также нет проверки `factor` (например, `factor <= 0` даст отрицательную/нулевую цену) — стоит явно валидировать входной параметр перед массовым обновлением цен категории.

---

### Итог по критичности
- Блокеры (critical), обязательно исправить до мерджа: #1, #2, #3, #4, #5, #6.
- High, желательно исправить до мерджа: #7, #8.
- Medium: #9, #10.
- Low (можно вынести в follow-up): #11.
