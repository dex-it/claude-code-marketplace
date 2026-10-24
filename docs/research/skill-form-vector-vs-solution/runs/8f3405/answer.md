Провёл ревью четырёх файлов MR (код не менял, файлы вне каталога не трогал). Результат ниже и сохранён в `_answer.md`.

## 1. CustomerExport.cs — `CustomersWithOrders` — **critical**
`orders.Select(o => o.Customer).Distinct()` — `Distinct()` на сущностях `Customer` без переопределённых `Equals`/`GetHashCode` (пункт чек-листа «Distinct() на объектах»). Запрос идёт с `AsNoTracking()`, поэтому EF не делает identity resolution: у клиента с несколькими заказами в периоде каждый `Order.Customer` — отдельный объект-ссылка. `Distinct()` их не схлопнет, и CRM-выгрузка вернёт дубли клиента. Ломает саму цель метода. Фикс: `GroupBy(o => o.CustomerId)` или `AsNoTrackingWithIdentityResolution()`.

## 2. SalesReport.cs — `Build` — **high**
`_products.GetAllAsync()` тянет из БД все продукты целиком (включая `Image byte[]`, `Description`), затем `IsActive` фильтруется уже в памяти («материализация в начале цепочки» + «полная сущность для списка»). Плюс внутри `Select` по продуктам для каждого делается `items.Where(i => i.ProductId == p.Id)` — линейный проход по всему списку `items`, т.е. O(P×I) («поиск по списку в цикле»). Нужны фильтрация на стороне БД, проекция только нужных полей и предварительная группировка `items` (`ToLookup`/`GroupBy`).

## 3. StockImport.cs — `Import` — **high**
`_db.Products.ToListAsync()` грузит всю таблицу целиком (с `Image`), а затем на каждую строку CSV — `products.FirstOrDefault(p => p.Id == id)`, линейный перебор всего списка на каждой итерации: O(N×M) («полная сущность для списка» + «поиск по списку в цикле»). При большом каталоге/файле импорт деградирует. Нужен `Dictionary<Guid, Product>` перед циклом (или batch-update по id из файла).

## 4. CustomerExport.cs — `HasOrders` — **medium**
`await _db.Orders.CountAsync(...) > 0` — классический пункт «Проверка наличия через Count() > 0»: SQL считает все совпадения вместо `EXISTS`. Заменить на `AnyAsync`.

## 5. CatalogSearch.cs — `Search` — **low**
4 ветки if с отдельной материализацией (`ToListAsync`) вместо одного составного `IQueryable` с условными `.Where()` — «материализация в каждой ветке динамического запроса». Сейчас багов не даёт, но комбинаторно взрывается при добавлении новых фильтров и рискует рассинхронизацией условий между копипаст-ветками.

Ответ записан в `/Users/anonymous/.cache/research/runs/8f3405/work/_answer.md`.