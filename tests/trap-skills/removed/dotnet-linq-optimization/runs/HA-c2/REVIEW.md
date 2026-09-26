# Review MR: SalesReport.cs, CustomerExport.cs, CatalogSearch.cs, StockImport.cs

Контекст (Model.cs, ShopDbContext.cs, ProductRepository.cs, OrderIntake.cs, OrderConfirmation.cs,
PaymentWebhook.cs, ShippingPlanner.cs) прочитан для доменной модели, ревью правит только 4 файла MR.

## CustomerExport.cs

### CustomerExport.cs:19-23 - `.Distinct()` не дедуплицирует клиентов
```csharp
return orders
    .Select(o => o.Customer)
    .Distinct()
    .OrderBy(c => c.Email)
    .ToList();
```
Запрос строк 13-17 использует `AsNoTracking()` без `AsNoTrackingWithIdentityResolution()`. По
умолчанию no-tracking запрос EF Core НЕ делает identity resolution: если один Customer достижим
через несколько строк Orders (клиент с >1 заказом в периоде), для каждой строки материализуется
отдельный `Customer`-инстанс с одинаковыми данными. `Customer` не переопределяет `Equals`/
`GetHashCode`, поэтому `.Distinct()` сравнивает по ссылке и не находит дублей.
Чем кончится: выгрузка для CRM содержит клиента столько раз, сколько у него заказов в периоде -
именно для тех активных клиентов, ради которых выгрузка и делается. Метод не выполняет свою
заявленную задачу («клиенты, делавшие заказы» подразумевает список без повторов).
Severity: blocker.

### CustomerExport.cs:27 - `CountAsync(...) > 0` вместо `AnyAsync(...)`
```csharp
await _db.Orders.CountAsync(o => o.CustomerId == customerId, ct) > 0;
```
`CountAsync` транслируется в `SELECT COUNT(*)` по всем совпадающим строкам, тогда как для проверки
существования достаточно `EXISTS`/`LIMIT 1` через `AnyAsync`. Для клиента с большим числом заказов
БД сканирует и считает все совпадения вместо остановки на первом.
Чем кончится: лишняя нагрузка на БД при каждом вызове, масштабируется хуже числа заказов клиента.
Severity: minor.

## SalesReport.cs

### SalesReport.cs:22 - отбор OrderItems без фильтра по статусу заказа
```csharp
var items = await _db.OrderItems
    .Where(i => i.Order.CreatedAt >= from && i.Order.CreatedAt < to)
    .ToListAsync(ct);
```
`Order.Status` (Model.cs:18) принимает значения `New, Accepted, Rejected, Confirmed, Paid`. Запрос
берёт позиции ЛЮБОГО заказа за период - включая `Rejected` (см. OrderIntake.Accept: заказ с >50
позиций получает статус `Rejected`, но остаётся в БД) и `New`/`Accepted`, ещё не подтверждённые
(OrderConfirmation.ConfirmPending подтверждает не все `New` - блокированным клиентам заказ не
подтверждается и статус остаётся `New`).
Чем кончится: отчёт о продажах суммирует выручку и количество по заказам, которые фактически не
были продажей (отменены или не подтверждены) - цифры отчёта завышены, решения на его основе
(закупки, премии, аналитика) считаются на искажённых данных.
Severity: major.

### SalesReport.cs:27-30 - вложенный проход по items на каждый продукт (O(P*I))
```csharp
.Select(p =>
{
    var sold = items.Where(i => i.ProductId == p.Id).ToList();
    return new ProductSalesRow(p.Id, p.Name, sold.Sum(i => i.Qty), sold.Sum(i => i.Qty * i.Price));
})
```
Для каждого активного продукта `items.Where(...)` линейно сканирует весь список позиций заказов за
период. Сложность O(число активных продуктов x число позиций за период) вместо одного прохода
(группировка по `ProductId` в `Dictionary`/`GroupBy` до цикла, в памяти или на стороне SQL).
Чем кончится: при отчёте за длинный период (квартал/год) с заметным каталогом и объёмом продаж
время построения отчёта растёт квадратично - вплоть до таймаута запроса/джобы.
Severity: major.

### SalesReport.cs:20 - весь каталог продуктов грузится трекающим запросом и фильтруется в памяти
```csharp
var products = await _products.GetAllAsync(ct);
...
products.Where(p => p.IsActive)
```
`ProductRepository.GetAllAsync` (ProductRepository.cs:10-11) без `AsNoTracking()` тащит в контекст
ВСЕ продукты (включая неактивные) и ставит их под change tracking, а фильтр `IsActive` применяется
уже в памяти. Для read-only построения отчёта фильтр и `AsNoTracking()` должны быть в запросе к БД.
Чем кончится: лишний трафик и лишняя память на неактивные продукты, лишняя нагрузка на change
tracker `_db` для чисто читающей операции.
Severity: minor.

## CatalogSearch.cs

### CatalogSearch.cs:16-36 - у поиска нет ограничения размера результата
Ни одна из четырёх веток (в частности ветка без фильтров, строки 33-35) не ограничивает выборку
(`Take`/paging). При отсутствии `category` и `maxPrice` метод вернёт ВСЕ активные товары каталога
одним ответом.
Чем кончится: с ростом каталога ответ поиска растёт без предела - память сервиса, размер полезной
нагрузки и время ответа не ограничены; при большом каталоге - фактический DoS на себя же по памяти
и трафику для самого частого случая (поиск без фильтров).
Severity: major.

### CatalogSearch.cs:18-35 - четыре почти идентичные ветки вместо одного запроса
Условия `category != null`, `maxPrice != null` продублированы в 4 копиях запроса вместо одного
`Where(p => p.IsActive && (category == null || p.Category == category) && (maxPrice == null ||
p.Price <= maxPrice))`. Функционально ветки эквивалентны (бага не нашёл), но правка условия придётся
вносить в четырёх местах синхронно.
Чем кончится: риск разъезда веток при будущей правке (поправили одну ветку, забыли другую).
Severity: minor.

## StockImport.cs

### StockImport.cs:21,34 - отрицательное количество из файла принимается без проверки
```csharp
if (parts.Length != 2 || !Guid.TryParse(parts[0], out var id) || !int.TryParse(parts[1], out var qty))
{
    invalid++;
    continue;
}
...
product.Stock = qty;
```
`int.TryParse` успешно парсит `"-5"` как валидное число - строка не попадает в `invalid`, значение
пишется в `Stock` напрямую. Домен остатков отрицательным быть не должен (Model.cs:41, `int Stock`
без иных ограничений, во всём остальном коде `Stock`/`Qty` используются как неотрицательные).
Чем кончится: файл поставщика с опечаткой или отрицательной корректировкой молча портит остаток
товара в БД (уходит в минус), `ImportResult` при этом рапортует строку как `Updated`, а не `Invalid`.
Severity: major.

### StockImport.cs:27 - поиск продукта по id линейным сканированием списка на каждую строку файла
```csharp
var product = products.FirstOrDefault(p => p.Id == id);
```
`products` (строка 15) - весь каталог, загруженный один раз, но `FirstOrDefault` внутри `foreach` по
строкам CSV сканирует список каждый раз: сложность O(строк CSV x размер каталога) вместо построения
`Dictionary<Guid, Product>` перед циклом.
Чем кончится: импорт большого прайса поставщика на большом каталоге деградирует квадратично по
времени.
Severity: major.

### StockImport.cs:18 - синхронное чтение файла в асинхронном методе
```csharp
foreach (var line in File.ReadLines(csvPath).Skip(1))
```
`File.ReadLines` - блокирующий синхронный I/O, вызывается из `async Task<ImportResult>` без
асинхронной альтернативы (`StreamReader.ReadLineAsync`/буферизованное асинхронное чтение).
Чем кончится: поток, на котором исполняется метод, простаивает на дисковом I/O вместо освобождения
в пул - на большом файле это заметная задержка потока при конкурентных вызовах (например, в
веб-обработчике или в джобе, делящей пул с другими задачами).
Severity: minor.

### StockImport.cs:34-35 - повторная строка с тем же productId в файле задваивает счётчик `Updated`
При двух строках CSV с одинаковым `id` (например, дубль в выгрузке поставщика) `product.Stock`
перезапишется вторым значением, но `updated++` инкрементируется на КАЖДУЮ строку - по факту к БД
применилось одно итоговое изменение на продукт, а `ImportResult.Updated` посчитает строки, а не
затронутые продукты.
Чем кончится: отчёт об импорте (`Updated`) не совпадает с реальным числом изменённых товаров при
дублях в файле поставщика - вводит в заблуждение того, кто читает результат импорта.
Severity: minor.

## Итог по severity
- blocker: 1
- major: 5
- minor: 5
- Всего находок: 11
