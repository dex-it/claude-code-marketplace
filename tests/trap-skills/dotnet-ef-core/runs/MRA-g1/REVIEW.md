# Review MR: SalesReport.cs, CustomerExport.cs, CatalogSearch.cs, StockImport.cs

Контекст: EF Core 8 + Npgsql 8, `ShopDbContext` не содержит `OnModelCreating`/Fluent-конфигурации,
поэтому на все `DateTime`-свойства (в т.ч. `Order.CreatedAt`) действует конвенция Npgsql по умолчанию —
колонка `timestamp with time zone` (timestamptz), значение обязано иметь `Kind=Utc`.

---

## Блокеры (blocker)

### 1. CustomerExport.cs:19-23 — `Distinct()` не убирает дубликаты клиентов
```csharp
return orders
    .Select(o => o.Customer)
    .Distinct()
    .OrderBy(c => c.Email)
    .ToList();
```
Запрос выполнен с `AsNoTracking()` (строка 14) без `AsNoTrackingWithIdentityResolution()`. Для no-tracking
запросов без identity resolution EF Core материализует **новый экземпляр** `Customer` для каждой строки
результата (для каждого `Order`), даже если это один и тот же клиент. `Customer` не переопределяет
`Equals`/`GetHashCode`, поэтому `.Distinct()` работает по ссылочному равенству и не схлопывает дубликаты.
Чем это кончится: клиент с несколькими заказами в периоде попадёт в выгрузку для CRM (см. комментарий в
строке 10) столько раз, сколько у него заказов — ровно то, что `Distinct()` должен был предотвратить.
Нужно либо `AsNoTrackingWithIdentityResolution()`, либо группировка/`DistinctBy(c => c.Id)` после материализации.
Severity: blocker (выгрузка для CRM молча содержит дубликаты).

### 2. StockImport.cs:21,34 — отрицательное количество принимается и пишется в БД
```csharp
if (parts.Length != 2 || !Guid.TryParse(parts[0], out var id) || !int.TryParse(parts[1], out var qty))
{
    invalid++;
    continue;
}
...
product.Stock = qty;
```
`int.TryParse` успешно парсит отрицательные числа ("‑5" валиден), проверки `qty >= 0` нет. Строка не
попадает в `invalid`, продукт помечается как `updated`, а в БД записывается отрицательный остаток.
Чем это кончится: молчаливая порча остатков (`Stock < 0`), которая ниже по цепочке (планирование отгрузок,
каталог, резервирование при заказах) не ожидается и может привести к некорректным решениям о доступности
товара; `ImportResult` при этом отрапортует "успешно обновлено", не показывая проблему.
Severity: blocker.

---

## Major

### 3. SalesReport.cs:20 — незащищённая от чтения выборка + overfetch всей таблицы Product
```csharp
var products = await _products.GetAllAsync(ct);
```
`ProductRepository.GetAllAsync` — это `_db.Products.ToListAsync(ct)` без `AsNoTracking()`. Метод `Build`
только читает данные для отчёта, ничего не сохраняет — по чек-листу такие выборки обязаны быть
`AsNoTracking`. Кроме того, загружаются **все** продукты (включая неактивные — фильтр `p.IsActive`
применяется только в строке 26, уже после материализации) и все столбцы, включая `Image` (`byte[]`,
потенциально тяжёлый BLOB) и `Description`, которые в отчёте не используются.
Чем это кончится: на каждый вызов отчёта — лишняя нагрузка на change tracker (память, CPU на снапшоты) и
избыточный трафик/память из-за подтягивания неиспользуемых столбцов и неактивных товаров. При большом
каталоге с изображениями это может быть существенно.
Severity: major.

### 4. SalesReport.cs:21-23 — `OrderItems` читается без `AsNoTracking`
```csharp
var items = await _db.OrderItems
    .Where(i => i.Order.CreatedAt >= from && i.Order.CreatedAt < to)
    .ToListAsync(ct);
```
Тоже чисто читающий запрос (отчёт), но без `AsNoTracking()` — EF будет трекать каждую загруженную
`OrderItem` (и присоединённые через join `Order`, если они попадут в тот же контекст в рамках запроса).
Чем это кончится: ненужный расход памяти/CPU на change tracking для потенциально большого числа строк
заказов за отчётный период, особенно при повторных вызовах в рамках одного `DbContext` (в веб-запросе).
Severity: major.

### 5. SalesReport.cs:18,22 / CustomerExport.cs:11,16 — `DateTime from/to` без гарантии `Kind=Utc`
```csharp
public async Task<List<ProductSalesRow>> Build(DateTime from, DateTime to, CancellationToken ct = default)
...
.Where(i => i.Order.CreatedAt >= from && i.Order.CreatedAt < to)
```
```csharp
public async Task<List<Customer>> CustomersWithOrders(DateTime from, DateTime to, CancellationToken ct = default)
...
.Where(o => o.CreatedAt >= from && o.CreatedAt < to)
```
`Order.CreatedAt` маппится по умолчанию в `timestamptz`, где Npgsql 8 требует `Kind=Utc` для записи
параметра; `Kind=Local` вызывает исключение при отправке параметра в Npgsql, а `Kind=Unspecified` (типичный
результат `new DateTime(...)`, парсинга дат из UI и т.п.) молча трактуется как UTC. Метод не документирует
и не нормализует ожидаемый `Kind` входных `from`/`to`.
Чем это кончится: либо runtime-исключение при вызове с `DateTime.Now`/`DateTime.Today` (Kind=Local), либо,
что хуже, тихий сдвиг границ периода на величину смещения часового пояса при вызове с Kind=Unspecified —
отчёт/выгрузка молча берут не те даты без какой-либо ошибки.
Severity: major (в обоих файлах).

### 6. SalesReport.cs:29-30 — агрегация выполняется в памяти, а не в БД
```csharp
var sold = items.Where(i => i.ProductId == p.Id).ToList();
return new ProductSalesRow(p.Id, p.Name, sold.Sum(i => i.Qty), sold.Sum(i => i.Qty * i.Price));
```
Вместо `GROUP BY` на стороне БД в память вытягиваются вообще все `OrderItem` за период (строка 21-23), а
затем для каждого продукта делается линейный проход по всему списку (`items.Where`) — сложность
O(products × orderItems). Плюс сами данные (весь набор строк заказов за период) полностью грузятся в
память процесса вместо агрегата.
Чем это кончится: при росте объёма заказов/каталога построение отчёта деградирует нелинейно по времени и
по памяти (риск таймаутов/OOM для отчётов за длинные периоды).
Severity: major.

### 7. StockImport.cs:15,27 — вся таблица `Products` в памяти + линейный поиск на каждую строку CSV
```csharp
var products = await _db.Products.ToListAsync(ct);
...
var product = products.FirstOrDefault(p => p.Id == id);
```
Для импорта грузится полностью вся таблица `Product` (без ограничения по встречающимся в CSV id), а затем
для каждой строки файла делается `FirstOrDefault` — линейный проход по списку. Сложность O(каталог × строки
файла).
Чем это кончится: при большом каталоге и/или большом файле поставщика импорт становится заметно медленнее,
чем необходимо (линейна к произведению размеров, а не к сумме); также лишний трафик из БД для товаров,
которых нет в файле. Стоит грузить точечно (`Where(p => idsFromCsv.Contains(p.Id))`) и держать `Dictionary<Guid,Product>`.
Severity: major.

---

## Minor

### 8. CustomerExport.cs:26-27 — `CountAsync(...) > 0` вместо `AnyAsync`
```csharp
public async Task<bool> HasOrders(Guid customerId, CancellationToken ct = default) =>
    await _db.Orders.CountAsync(o => o.CustomerId == customerId, ct) > 0;
```
`CountAsync` транслируется в `SELECT COUNT(*)` по всем совпадениям, тогда как нужен только факт
существования — `AnyAsync` транслируется в `EXISTS` и не досчитывает все строки.
Чем это кончится: лишняя работа БД (полный подсчёт вместо остановки на первом совпадении), тем заметнее,
чем больше заказов у клиента. Функционально не ломает, только неоптимально.
Severity: minor.

### 9. CatalogSearch.cs:16-36 — дублирование четырёх почти идентичных веток без пагинации
```csharp
if (category != null && maxPrice != null) ...
if (category != null) ...
if (maxPrice != null) ...
return await _db.Products.AsNoTracking().Where(p => p.IsActive)...
```
Сейчас во всех четырёх ветках условие `p.IsActive` и структура запроса согласованы, но при дальнейшем
добавлении фильтров/условий придётся не забыть поправить все 4 копии — риск рассинхронизации в будущем.
Дополнительно ни в одной ветке нет пагинации/лимита (`Skip/Take`) — при широких фильтрах (`category=null,
maxPrice=null`) метод вернёт весь активный каталог целиком.
Чем это кончится: не сейчас, а при следующих правках — забытое условие в одной из веток; и уже сейчас —
потенциально большой ответ при пустых фильтрах.
Severity: minor.

### 10. StockImport.cs:34 — импорт обновляет и неактивные (`IsActive=false`) товары
```csharp
var product = products.FirstOrDefault(p => p.Id == id);
...
product.Stock = qty;
```
`_db.Products` в строке 15 грузится без фильтра по `IsActive`, соответственно остаток проставляется в том
числе для деактивированных/снятых с продажи товаров. Возможно, это осознанное поведение (поставщик всё
равно поставляет остатки), но в MR это нигде не оговорено.
Чем это кончится: если ожидалось, что деактивированные товары импорт не трогает — их `Stock` будет тихо
меняться "в фоне" без видимого эффекта в каталоге, что может путать при повторной активации товара.
Severity: minor (требует уточнения ожидаемого поведения).

### 11. StockImport.cs:18 — синхронное чтение файла в async-методе
```csharp
foreach (var line in File.ReadLines(csvPath).Skip(1))
```
`File.ReadLines` — блокирующий синхронный I/O внутри `async Task`-метода; поток из пула блокируется на
время чтения файла с диска вместо await на асинхронном чтении.
Чем это кончится: при частых/параллельных запусках импорта — лишнее давление на пул потоков; для разового
job-а некритично, но не соответствует общему асинхронному стилю остального кода.
Severity: minor.

---

## Итог по severity
- blocker: 2
- major: 5
- minor: 4

Итого находок: 11.
