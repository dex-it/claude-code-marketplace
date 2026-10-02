# Ревью MR !4127 (сервисы заказов и каталога для админки)

## Critical

### 1. Services/OrderAdmin.cs — `RecalcTotal`
Сумма заказа считается без учёта количества:
```csharp
order.Total = order.Items.Sum(i => prices[i.ProductId]);
```
`Product.Price` — цена за единицу, `OrderItem.Qty` — количество (это прямо оговорено в контексте MR), но `Qty` нигде не участвует в расчёте. Должно быть `Sum(i => prices[i.ProductId] * i.Qty)`. Сейчас пересчёт суммы заказа даёт неверный (заниженный при Qty>1) итог для любого заказа с количеством больше единицы — это основная бизнес-функция метода, и она сломана.
Дополнительно: если `i.ProductId` отсутствует в `prices` (удалённый/несуществующий товар), обращение к словарю по индексатору упадёт с `KeyNotFoundException` — стоит явно обработать.

### 2. Migrations/20260920_OrderCategories.cs + Model.cs — рассинхронизация модели и миграции
Миграция дропает колонку `Orders.Category`:
```csharp
mb.DropColumn("Category", "Orders");
```
но `Model.cs` (по условию не менявшийся в этом MR) по-прежнему содержит `public string Category { get; set; }` на `Order`, и никакого `DbSet<Category>` / навигационного свойства к `OrderCategories` в `ShopDbContext`/`Order` не добавлено. После применения миграции EF-модель всё ещё считает, что у `Orders` есть колонка `Category`, и будет генерировать SQL с обращением к несуществующей колонке — упадут практически все запросы к `Orders` (`GetCard`, `ExportForCustomer`, `UpdateOrder`, `RecalcTotal`, `OverdueReport` и т.д.) с ошибкой вида `42703: column o.Category does not exist`. Миграция и код сервисов, использующих `order.Category` (например `OrderAdmin.UpdateOrder`), логически завязаны на модель, которая не соответствует новой схеме. Фича не доведена до конца: либо забыли обновить `Model.cs`/добавить `Categories`/`OrderCategories` в контекст, либо миграция мёржилась раньше времени.

### 3. Migrations/20260920_OrderCategories.cs — `Up`: потеря данных
`Up()` дропает текстовую колонку `Category` без предварительного переноса существующих значений в новые таблицы `Categories`/`OrderCategories`. Для всех уже существующих заказов информация о категории необратимо теряется при накатывании миграции — нет ни одного `INSERT ... SELECT DISTINCT Category`, ни заполнения `OrderCategories` по текущим данным.

### 4. Services/CatalogService.cs — `Reserve`
```csharp
var product = await _db.Products
    .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId)
    .SingleAsync();
if (product.Stock < qty) return false;
product.Stock -= qty;
await _db.SaveChangesAsync();
```
`FOR UPDATE` не обёрнут в явную транзакцию, разделяемую с последующим `SaveChangesAsync`. Без `_db.Database.BeginTransactionAsync()` каждая из двух команд (SELECT ... FOR UPDATE и UPDATE от SaveChanges) выполняется в своей неявной транзакции — блокировка строки снимается сразу после SELECT, до того как записан декремент `Stock`. Два одновременных вызова `Reserve` для одного и того же товара могут оба прочитать одинаковый `Stock`, оба пройти проверку и оба списать — overselling/уход остатка в минус. Смысл `FOR UPDATE` в текущем виде полностью теряется.

### 5. Services/OrderQueries.cs — `GetProductBySku`
```csharp
public Task<Product> GetProductBySku(string sku) =>
    _db.Products.AsNoTracking().SingleAsync(p => p.Sku == sku);
```
По контексту модели один SKU лежит на нескольких складах (уникален только в рамках склада). `SingleAsync` гарантированно бросит `InvalidOperationException` ("Sequence contains more than one element"), как только у SKU больше одной строки — то есть в штатном, а не исключительном случае. Метод либо должен принимать склад, либо возвращать коллекцию/агрегат.

### 6. Workers/OverdueNotifier.cs — DI lifetime scoped-в-singleton
```csharp
public class OverdueNotifier : BackgroundService
{
    private readonly ShopDbContext _db;
    public OverdueNotifier(ShopDbContext db) => _db = db;
```
и в `Program.cs`: `builder.Services.AddHostedService<OverdueNotifier>();`. `AddHostedService` регистрирует сервис как singleton, а `ShopDbContext` зарегистрирован через `AddDbContext` со scoped-временем жизни. Это классическое нарушение «captive dependency»: при включённой валидации скоупов (по умолчанию в Development) приложение упадёт прямо на старте при построении `IHostedService`. В Production (где валидация обычно выключена) будет один и тот же экземпляр `ShopDbContext` использоваться всё время жизни процесса в цикле раз в минуту: `ChangeTracker` бесконечно копит добавленные `AuditLog`-сущности (они никогда не отсоединяются после `SaveChangesAsync`), `DbContext` не потокобезопасен, и это чревато утечкой памяти/деградацией и гонками, если тот же контекст где-то ещё используется параллельно. Нужно внедрять `IServiceScopeFactory`/`IServiceProvider` и создавать scope (и новый `ShopDbContext`) на каждой итерации.

## High

### 7. Services/OrderQueries.cs — `LastShippedAt`
```csharp
var last = await _db.Orders.Where(o => o.CustomerId == customerId).MaxAsync(o => o.ShippedAt);
return last!.Value;
```
`MaxAsync` по nullable-колонке вернёт `null`, если у клиента нет заказов вообще или ни один ещё не отгружен (обычная ситуация для нового клиента/свежего заказа). `last!.Value` в этом случае бросит `InvalidOperationException`. Null-forgiving `!` здесь маскирует реальный сценарий, который не обработан — метод должен возвращать `DateTime?` либо явно обрабатывать отсутствие отгрузок.

### 8. Services/OrderQueries.cs — `ExportForCustomer`
```csharp
_db.Orders.Where(o => o.CustomerId == customerId)
    .Include(o => o.Items).Include(o => o.Payments)
    .AsNoTracking().ToListAsync();
```
В отличие от соседнего `GetCard` в этом же файле, здесь нет `AsSplitQuery()`. Два `Include` к разным коллекциям (`Items`, `Payments`) в одном SQL-запросе дают декартово произведение (Items × Payments на каждый заказ) — при выгрузке заказов клиента, у которого, по описанию MR, «тысячи заказов», это может привести к колоссальному раздуванию объёма данных и памяти по сравнению с реальным количеством строк. Нужен `AsSplitQuery()`, как в `GetCard`.

### 9. Services/OrderAdmin.cs — `UpdateOrder`
Правка заказа не проверяет конкурентность:
```csharp
var order = await _db.Orders.FirstAsync(o => o.Id == edit.Id);
order.Status = edit.Status;
order.Category = edit.Category;
await _db.SaveChangesAsync();
```
MR явно описывает сценарий «в админке несколько операторов правят заказы одновременно», но нет ни concurrency-токена (rowversion/xmin), ни какой-либо проверки, что заказ не был изменён другим оператором между чтением и записью. Последняя сохранённая правка молча перезатирает предыдущую — классический lost update, о котором явно предупреждает сам текст MR.

### 10. Services/OrderAdmin.cs — `OverdueReport`
```csharp
var all = await _repo.GetAllAsync();  // SELECT * FROM Orders без фильтра
return all.Where(o => o.IsOverdue(now)).Select(o => o.Id).ToList();
```
Загружается вся таблица `Orders` в память, фильтрация по просрочке делается на клиенте, вместо того чтобы перенести предикат в SQL (как правильно сделано в `Workers/OverdueNotifier.cs` в этом же MR). При объёмах, упомянутых в MR («у крупных клиентов тысячи заказов»), это ощутимая проблема производительности и памяти, и это прямое несоответствие с соседней реализацией того же самого условия просрочки.

### 11. Services/CatalogService.cs — `Reprice`
```csharp
var products = await _db.Products.Where(p => p.Category == category).ToListAsync(); // tracked
foreach (var p in products) p.Price *= factor;
_db.UpdateRange(products);
await _db.SaveChangesAsync();
```
Сущности уже отслеживаются (загружены без `AsNoTracking`), поэтому `UpdateRange` избыточен — но его побочный эффект в том, что он помечает **все** свойства сущности как Modified, а не только `Price`. В сгенерированном UPDATE будет перезаписан и `Stock` тем значением, которое было прочитано в начале `Reprice`. Если между чтением и `SaveChangesAsync` параллельно отработал `Reserve` (уменьшил `Stock`), `Reprice` откатит это изменение назад — lost update по остатку между переоценкой и резервированием.

## Low

### 12. Services/CatalogService.cs — `Search`
Динамический SQL собирается вручную строковой конкатенацией условий с параллельным списком именованных параметров `@p{n}`/`p{n}`, синхронизируемых только по порядку добавления в оба списка. Сейчас конкретные значения параметризованы корректно (SQL-инъекции нет), но конструкция хрупкая для сопровождения — при добавлении нового фильтра легко разъехаться в нумерации или случайно вставить значение напрямую в SQL-текст. Предпочтительнее `FromSqlInterpolated` или построение через `IQueryable`/`Where`-цепочку без raw SQL.

### 13. Services/CatalogService.cs — `Reserve`
Нет валидации `qty > 0`; отрицательное или нулевое значение проходит через проверку `product.Stock < qty` и может увеличить остаток вместо резервирования.
