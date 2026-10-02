Провёл ревью 4 файлов MR. Основные находки (полный текст также записан в `_answer.md`):

**SalesReport.cs — `Build`**
1. `_products.GetAllAsync()` грузит все колонки всех товаров (включая `Image: byte[]`), фильтр `IsActive` — в памяти вместо SQL. **high**
2. Внутри `.Select()` по продуктам — `items.Where(i => i.ProductId == p.Id)` — O(products×items) join в памяти вместо `ToLookup`. **medium**
3. Запрос `OrderItems` не фильтрует по `Order.Status` — в выручку/продажи попадают `Rejected`/`New`/`Accepted` (неоплаченные) заказы. **high**

**CustomerExport.cs**
4. `CustomersWithOrders`: `.Distinct()` на `Customer`, полученных через `AsNoTracking()` — сравнение по ссылке, клиенты с несколькими заказами дублируются в CRM-выгрузке. **high**
5. `HasOrders`: `CountAsync(...) > 0` вместо `AnyAsync(...)`. **medium**

**CatalogSearch.cs — `Search`**
6. 4 ветки условия, в каждой свой `ToListAsync()`, вместо одного `IQueryable`, построенного условно, и единственного `ToListAsync()` в конце — риск расхождения веток при будущих изменениях. **medium**

**StockImport.cs — `Import`**
7. `products.FirstOrDefault(p => p.Id == id)` в цикле по строкам CSV вместо `Dictionary` — O(products×строк). **high**
8. Отрицательные `qty` проходят парсинг и пишутся в `Stock` без бизнес-валидации, не попадая в `Invalid`. **medium**
9. Дубликаты `productId` в CSV завышают счётчик `Updated` (данные не портятся, но статистика вводит в заблуждение). **low**