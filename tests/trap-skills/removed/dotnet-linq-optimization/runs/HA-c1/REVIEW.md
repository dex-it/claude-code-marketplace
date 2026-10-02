# Review: SalesReport.cs, CustomerExport.cs, CatalogSearch.cs, StockImport.cs

## SalesReport.cs

### 1. SalesReport.cs:21-23 - нет фильтра по Order.Status - severity: blocker
`_db.OrderItems.Where(i => i.Order.CreatedAt >= from && i.Order.CreatedAt < to)` берёт позиции
заказа по дате без учёта `Order.Status`. `OrderItem` создаётся до решения по заказу (см.
`OrderIntake.Accept`, где заказ и его items уже существуют на момент проверки лимита и возможного
`Rejected`), поэтому в выборку попадают позиции заказов `New` и `Rejected`, не только `Confirmed`/`Paid`.
Кончится тем, что `SoldQty`/`Revenue` в отчёте о продажах включают неоплаченные и отклонённые
заказы - отчёт систематически завышает продажи, на нём принимаются бизнес-решения.

### 2. SalesReport.cs:20,25-31 - ручной nested-loop join вместо группировки - severity: major
`_products.GetAllAsync()` тянет вообще все продукты (включая неактивные, `IsActive` фильтруется
уже в памяти), затем для каждого продукта `items.Where(i => i.ProductId == p.Id)` (строка 29)
сканирует весь список `items` заново - это O(products x items) в памяти вместо `GroupBy`/`Dictionary`
по `ProductId`, который сделал бы работу за один проход. На каталоге и объёме заказов реального
магазина это деградирует до таймаутов/высокой нагрузки на GC при росте обеих коллекций.

### 3. SalesReport.cs:21 - `OrderItems` без `AsNoTracking()` - severity: minor
Запрос read-only (только для построения отчёта), но сущности попадают под трекинг change tracker'а -
лишний оверхед памяти на большой выборке позиций заказа.

## CustomerExport.cs

### 4. CustomerExport.cs:13-23 - `Distinct()` не дедуплицирует клиентов - severity: blocker
Запрос собирает `Orders` с `Include(o => o.Customer)` под `AsNoTracking()`. Без трекинга EF Core не
делает identity resolution (это специально требует `AsNoTrackingWithIdentityResolution()`), поэтому
каждая строка `Order` материализует НОВЫЙ экземпляр `Customer`, даже если это один и тот же клиент с
несколькими заказами в периоде. `Customer` не переопределяет `Equals`/`GetHashCode`, так что
`orders.Select(o => o.Customer).Distinct()` (строка 21) сравнивает по ссылке и не убирает дубликаты.
Кончится тем, что выгрузка для CRM содержит по одной строке на каждый заказ клиента за период, а не
одну строку на клиента - т.е. дубли контактов там, где вызывающий явно ждёт distinct-список
(письма/рассылки клиенту продублируются). Нужен `AsNoTrackingWithIdentityResolution()`, либо
`DistinctBy(c => c.Id)`, либо дедуп на уровне `CustomerId` до материализации.

### 5. CustomerExport.cs:13-17 - лишний объём данных для дедупа в памяти - severity: minor
Метод тянет по одной строке `Order` на каждый заказ, чтобы затем в памяти свести к distinct
клиентам - для клиента с N заказами в периоде это N прочитанных строк вместо одной. Дешевле было бы
`_db.Customers.Where(c => c.Orders.Any(o => o.CreatedAt >= from && o.CreatedAt < to))` - фильтрация
и дедуп на стороне БД, без промежуточной коллекции `Order`.

## CatalogSearch.cs

### 6. CatalogSearch.cs:18-35 - четыре почти идентичные ветки фильтрации - severity: minor
`Search` перебирает 4 комбинации `category`/`maxPrice` явными `if`-ветками, каждая повторяет
`_db.Products.AsNoTracking().Where(p => p.IsActive ...).Select(Card).ToListAsync(ct)`. При добавлении
нового фильтра (например, по бренду) придётся править 4 копии - легко забыть одну из веток. Проще
собрать один `IQueryable` и добавлять `.Where(...)` условно.

### 7. CatalogSearch.cs:16-36 - нет пагинации - severity: minor
Метод возвращает весь результат без `Take`/`Skip`/лимита. При широком фильтре (либо вызове без
`category` и `maxPrice` вовсе - последняя ветка, строки 33-35) результат - весь активный каталог
целиком в одном ответе.

## StockImport.cs

### 8. StockImport.cs:27 - линейный поиск продукта на каждой строке файла - severity: major
`products.FirstOrDefault(p => p.Id == id)` внутри `foreach` по строкам CSV сканирует весь список
`products` заново для каждой строки - O(products x lines). На крупном каталоге и большом файле от
поставщика импорт заметно деградирует по времени. Нужен `products.ToDictionary(p => p.Id)` один раз
перед циклом.

### 9. StockImport.cs:21,34 - отрицательное количество принимается как валидное - severity: major
`int.TryParse(parts[1], out var qty)` пропускает любое целое число, включая отрицательное - строка
`"id;-5"` пройдёт валидацию и на строке 34 `product.Stock = qty` запишет отрицательный остаток без
предупреждения, засчитавшись в `Updated`, а не в `Invalid`. Нет проверки `qty >= 0`. Кончится тем,
что кривая строка от поставщика молча портит остаток товара, и импорт отрапортует успех.

### 10. StockImport.cs:34 - перезапись Stock без проверки конкурентности - severity: minor
`product.Stock = qty` - полная перезапись значения, прочитанного в начале метода (строка 15), без
какого-либо concurrency-токена на `Product`. Если между чтением и `SaveChangesAsync` (конец метода)
остаток товара меняет другой процесс, импорт молча затрёт это изменение (lost update). В
просмотренном коде нет видимого конкурентного писателя в `Product.Stock`, поэтому риск умозрительный,
но защиты нет вовсе - стоит учесть перед тем как этот путь пойдёт в бой с параллельными процессами.

---

## Итог по severity
- blocker: 2 (SalesReport.cs:21-23, CustomerExport.cs:13-23)
- major: 3 (SalesReport.cs:20,25-31; StockImport.cs:27; StockImport.cs:21,34)
- minor: 5 (SalesReport.cs:21; CustomerExport.cs:13-17; CatalogSearch.cs:18-35; CatalogSearch.cs:16-36; StockImport.cs:34)
