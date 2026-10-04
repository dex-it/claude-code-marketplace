# Ревью MR: SalesReport.cs, CustomerExport.cs, CatalogSearch.cs, StockImport.cs

Ревью по ловушкам LINQ из командного skill (`dotnet-linq-optimization`). Контекстные файлы
(Model.cs, ProductRepository.cs, ShopDbContext.cs) прочитаны для понимания сущностей и не правились.

## Находки

### 1. CustomerExport.cs:19-21 — Distinct() на Customer сравнивает по ссылке, дедупликация не работает

```
return orders
    .Select(o => o.Customer)
    .Distinct()
    .OrderBy(c => c.Email)
    .ToList();
```

`Customer` (Model.cs:3-10) не переопределяет `Equals`/`GetHashCode`. Запрос выше (строки 13-17)
использует `.AsNoTracking().Include(o => o.Customer)` — начиная с EF Core 5 no-tracking запросы
**не делают identity resolution** без явного `AsNoTrackingWithIdentityResolution()`. Значит каждая
строка `Order` материализует свой собственный экземпляр `Customer`, даже если `CustomerId`
одинаковый. `.Distinct()` по умолчанию — `ReferenceEquals`, поэтому клиент с несколькими заказами
в периоде попадёт в результат несколько раз.

Чем кончится: метод называется `CustomersWithOrders` и явно предназначен отдавать список клиентов
(не заказов) для выгрузки в CRM — при наличии повторных заказов в результате будут дубли одного и
того же клиента, CRM получит задвоенные записи (риск дублирующих кампаний/писем на одного клиента).

Severity: **blocker**.

Правка по skill: `DistinctBy(c => c.Id)` (.NET 6+) вместо `Distinct()`, либо
`AsNoTrackingWithIdentityResolution()` на исходном запросе.

---

### 2. CustomerExport.cs:27 — CountAsync() > 0 вместо AnyAsync()

```csharp
public async Task<bool> HasOrders(Guid customerId, CancellationToken ct = default) =>
    await _db.Orders.CountAsync(o => o.CustomerId == customerId, ct) > 0;
```

Прямое совпадение с ловушкой skill "Count() > 0 вместо Any()": `COUNT` досчитывает все совпадающие
строки заказов клиента, вместо того чтобы остановиться на первой (`EXISTS`).

Чем кончится: для клиентов с большой историей заказов — лишняя работа БД при каждом вызове
`HasOrders` (публичный метод, вероятный горячий путь — проверка перед блокировкой/удалением
клиента).

Severity: **major**.

Правка: `await _db.Orders.AnyAsync(o => o.CustomerId == customerId, ct)`.

---

### 3. SalesReport.cs:20 и :26 — вся таблица Product грузится целиком, фильтр IsActive — в памяти

```csharp
var products = await _products.GetAllAsync(ct);   // строка 20 — ВСЕ Product, все колонки
...
return products
    .Where(p => p.IsActive)                        // строка 26 — фильтр в C#, не в SQL
    .Select(p => { ... })
```

`ProductRepository.GetAllAsync` (ProductRepository.cs:10-11) не фильтрует и не проецирует — грузит
все строки `Products` целиком, включая `Image` (`byte[]`, Model.cs:43). Фильтрация `IsActive`
происходит уже в памяти — прямое совпадение с ловушкой "ToList() в начале цепочки — фильтрация в
памяти" и "Загружает всю entity для списка".

Чем кончится: отчёт по продажам гоняет через сеть и держит в памяти байты изображений всех
товаров (активных и неактивных), хотя нужны только `Id/Name/IsActive`. При росте каталога — рост
трафика и памяти пропорционален размеру `Image`, а не количеству нужных полей.

Severity: **major**.

Правка: фильтровать `IsActive` в SQL и проецировать нужные поля до материализации —
`_db.Products.Where(p => p.IsActive).Select(p => new { p.Id, p.Name }).ToListAsync(ct)` (в обход
`GetAllAsync`, либо доработать сам репозиторий под проекцию).

---

### 4. SalesReport.cs:29 — линейный поиск по items внутри Select на каждый продукт

```csharp
.Select(p =>
{
    var sold = items.Where(i => i.ProductId == p.Id).ToList();   // O(items) на каждый продукт
    ...
})
```

`items` — материализованный `List<OrderItem>` (строки 21-23). Для каждого активного продукта
выполняется полный проход по `items` в поиске совпадений по `ProductId` — эквивалент ловушки
"List.Contains в горячем пути — O(n)" / "FirstOrDefault вместо Dictionary", только через `Where`
вместо `FirstOrDefault`: итоговая сложность O(products × items) вместо O(products + items).

Чем кончится: при отчёте за длинный период (много `OrderItem`) и большом каталоге время построения
отчёта растёт квадратично; отчёт, который сегодня укладывается в секунды, при росте данных
магазина деградирует до заметных задержек или таймаута вызывающей стороны.

Severity: **major**.

Правка: сгруппировать `items` один раз — `items.GroupBy(i => i.ProductId).ToDictionary(...)` (или
`.ToLookup(i => i.ProductId)`) — и обращаться по ключу вместо повторного `Where`.

---

### 5. StockImport.cs:15 и :27 — вся таблица Product грузится целиком, поиск по ней — линейный на каждую строку CSV

```csharp
var products = await _db.Products.ToListAsync(ct);           // строка 15 — вся таблица, все колонки
...
foreach (var line in File.ReadLines(csvPath).Skip(1))
{
    ...
    var product = products.FirstOrDefault(p => p.Id == id);  // строка 27 — O(n) на каждую строку файла
```

Комбинация двух ловушек skill: "Загружает всю entity для списка" (загружаются все колонки
`Product`, включая `Image`, хотя меняется только `Stock`) и "FirstOrDefault вместо Dictionary"
(поиск по списку внутри цикла вместо `Dictionary`/`ToDictionary`).

Чем кончится: сложность импорта — O(|Products| × |строк CSV|). Для реалистичных объёмов (каталог в
десятки тысяч товаров, файл поставщика в тысячи строк) это миллионы сравнений на один импорт, плюс
память под все `Image` каталога, загруженные ради обновления единственного поля `Stock`. Импорт,
работающий на тестовых данных, при росте каталога/файла поставщика деградирует непропорционально и
рискует не укладываться в разумное время выполнения задачи.

Severity: **major**.

Правка: `var byId = await _db.Products.Select(p => p).ToDictionaryAsync(p => p.Id, ct)` — либо
загружать только нужные поля (`Id`, `Stock`) отдельной проекцией, если сущность не требуется целиком
для `SaveChangesAsync`; поиск — `byId.TryGetValue(id, out var product)` вместо `FirstOrDefault`.

---

### 6. CatalogSearch.cs:16-36 — четыре ветки с одинаковым дублированным `Select(Card).ToListAsync(ct)`

```csharp
if (category != null && maxPrice != null) return await _db.Products.AsNoTracking()...ToListAsync(ct);
if (category != null) return await _db.Products.AsNoTracking()...ToListAsync(ct);
if (maxPrice != null) return await _db.Products.AsNoTracking()...ToListAsync(ct);
return await _db.Products.AsNoTracking()...ToListAsync(ct);
```

Прямое совпадение с ловушкой skill "ToListAsync() в каждой ветке условия": каждая ветка — отдельный
путь построения запроса с повторяющимся `Where(p => p.IsActive)` и `Select(Card)`.

Чем кончится: сейчас поведение веток идентично (различаются только дополнительным предикатом), но
это дублирование — риск на будущее: добавление сортировки/пагинации/нового фильтра в одну ветку и
забытое — в другую даст расхождение поведения между комбинациями параметров, которое не поймает
компилятор.

Severity: **minor**.

Правка: строить `IQueryable<Product>` условно (`var query = _db.Products.AsNoTracking().Where(p =>
p.IsActive); if (category != null) query = query.Where(...); if (maxPrice != null) query =
query.Where(...);`), один `Select(Card).ToListAsync(ct)` в конце.

## Итог по severity

- blocker: 1
- major: 4
- minor: 1
- всего находок: 6
