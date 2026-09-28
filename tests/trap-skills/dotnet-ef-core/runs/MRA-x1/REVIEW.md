# Review MR: SalesReport.cs, CustomerExport.cs, CatalogSearch.cs, StockImport.cs

Контекст: EF Core 8 + Npgsql 8, .NET 8. В `ShopDbContext`/`Model.cs` нет `OnModelCreating`, явных `HasColumnType` и legacy-timestamp switch — то есть все `DateTime`-свойства (`Order.CreatedAt` и т.д.) маппятся по умолчанию Npgsql 8 в `timestamptz`, что требует `Kind=Utc` при записи/сравнении (см. SKILL.md).

---

## CustomerExport.cs

### CustomerExport.cs:15,19-21 — `Distinct()` по `Customer` не дедуплицирует после `AsNoTracking()+Include`
```csharp
.AsNoTracking()
.Include(o => o.Customer)
...
return orders.Select(o => o.Customer).Distinct().OrderBy(c => c.Email).ToList();
```
`AsNoTracking()` по умолчанию не делает identity resolution (нужен `AsNoTrackingWithIdentityResolution()`). Для клиента с несколькими заказами в периоде каждая строка `Order` материализует **новый** объект `Customer`, у `Customer` нет `Equals/GetHashCode` — `Distinct()` работает по ссылочному равенству и не схлопывает дубликаты. В выгрузку для CRM клиент с N заказами в периоде попадёт N раз.
**Severity: blocker** — метод ломает собственную заявленную цель (дедуп для CRM-выгрузки), результат уходит во внешнюю систему.

### CustomerExport.cs:27 — проверка наличия через `CountAsync() > 0`
```csharp
await _db.Orders.CountAsync(o => o.CustomerId == customerId, ct) > 0;
```
Вместо `AnyAsync` используется полный `COUNT(*)` по всем заказам клиента — сканирует все совпадающие строки вместо `EXISTS`/`LIMIT 1`. При большом числе заказов у клиента — лишняя работа БД на каждый вызов.
**Severity: major** — прямое нарушение зафиксированного в SKILL.md правила.

### CustomerExport.cs:16 — `DateTime from/to` сравниваются с `timestamptz`-колонкой без гарантии `Kind=Utc`
```csharp
.Where(o => o.CreatedAt >= from && o.CreatedAt < to)
```
Параметры `from`/`to` приходят как обычный `DateTime` без нормализации Kind. Если вызывающий код передаст `Kind=Local`/`Unspecified` (например, из локального времени сервера), то при трансляции в Npgsql-параметр для `timestamp with time zone` результат либо будет вычислен неверно (сравнение со сдвигом), либо Npgsql выбросит исключение в рантайме — в зависимости от Kind. Ни валидации, ни приведения к UTC в методе нет.
**Severity: major**.

---

## SalesReport.cs

### SalesReport.cs:20 — отчёт грузит и трекает весь каталог товаров
```csharp
var products = await _products.GetAllAsync(ct);
```
`ProductRepository.GetAllAsync` — это `_db.Products.ToListAsync(ct)` без `AsNoTracking()`. Для read-only отчёта в контекст трекинга попадают все товары (не только активные — фильтрация `IsActive` идёт уже в памяти на строке 26), что лишняя нагрузка на change tracker и риск случайных side-effect'ов, если тот же `DbContext` используется дальше в скоупе запроса.
**Severity: major** — нарушение правила "трекинг выборки только для чтения".

### SalesReport.cs:21-26 — в отчёт попадают позиции заказов независимо от `Order.Status`
```csharp
var items = await _db.OrderItems
    .Where(i => i.Order.CreatedAt >= from && i.Order.CreatedAt < to)
    .ToListAsync(ct);
...
return products.Where(p => p.IsActive).Select(p => { var sold = items.Where(i => i.ProductId == p.Id)... })
```
Нет фильтра по `Order.Status`. `OrderItem` создаются до подтверждения заказа (см. `OrderIntake.Accept`), и заказ может остаться `New`/стать `Rejected` — его позиции всё равно попадут в `sold`/`Revenue`. Отчёт о продажах посчитает выручку и количество по незавершённым/отклонённым заказам как по фактическим продажам.
**Severity: major** — искажение финансовой метрики (выручка/продажи), тихая ошибка без исключений.

### SalesReport.cs:22 — тот же риск `DateTime`/`timestamptz`, что и в CustomerExport.cs:16
`from`/`to` без гарантии `Kind=Utc` сравниваются с `i.Order.CreatedAt`.
**Severity: major**.

### SalesReport.cs:26 — фильтр `p.IsActive` тихо выбрасывает из отчёта продажи деактивированных товаров
Если товар был активен в отчётном периоде, но на момент построения отчёта деактивирован, его `OrderItem` из `items` не попадут ни в одну строку результата (строка формируется только для `products.Where(p => p.IsActive)`), т.е. проданное количество/выручка по нему нигде не отражаются — сумма по отчёту не совпадает с фактической выручкой за период.
**Severity: minor** — возможно осознанное решение (карточка каталога только для активных), но не документировано и приводит к расхождению итоговых цифр.

---

## CatalogSearch.cs

### CatalogSearch.cs:33-35 (и в целом весь метод `Search`) — нет пагинации/лимита
Ветка без фильтров (`category == null && maxPrice == null`) возвращает `_db.Products.Where(p => p.IsActive)` целиком, без `Take`/`Skip`. При большом каталоге — неограниченная выборка на каждый вызов поиска без фильтров.
**Severity: minor** — риск деградации на масштабе, не баг логики (сами фильтры `AsNoTracking()` и предикаты транслируются корректно, критичных находок по чек-листу EF в этом файле не обнаружено).

---

## StockImport.cs

### StockImport.cs:21 — нет валидации диапазона `qty` из внешнего файла
```csharp
if (parts.Length != 2 || !Guid.TryParse(parts[0], out var id) || !int.TryParse(parts[1], out var qty))
```
`int.TryParse` пропускает отрицательные числа (например, `"-5"`) как валидные — строка не помечается `invalid`, и на строке 34 `product.Stock = qty;` запишет отрицательный остаток. Ошибка/порча файла поставщика напрямую портит `Product.Stock` в БД без каких-либо признаков в `ImportResult`.
**Severity: major** — порча данных остатков от недоверенного внешнего входа без валидации.

### StockImport.cs:15 — загружается и трекается весь `Products` целиком под импорт
```csharp
var products = await _db.Products.ToListAsync(ct);
```
Вместо выборки только товаров, встречающихся в CSV (например, по собранному заранее набору id), в память и в change tracker загружается вся таблица товаров, затем для каждой строки CSV идёт `FirstOrDefault` по этому списку (строка 27) — O(n·m) при большом каталоге и импортном файле.
**Severity: minor** — согласуется с общим стилем остального кода в репозитории (полные выборки без фильтра есть и в других файлах), но при росте каталога — узкое место именно в файле, предположительно предназначенном для регулярных импортов.

### StockImport.cs:18-36 — дубли `productId` во входном CSV увеличивают счётчик `Updated`, не будучи реальными обновлениями
Если один и тот же `productId` встречается в файле несколько раз, `product.Stock = qty` перезапишется несколько раз (итоговое значение детерминировано — побеждает последняя строка), но `updated++` (строка 35) инкрементируется на каждую такую строку. `ImportResult.Updated` вводит в заблуждение относительно реального числа затронутых товаров.
**Severity: minor**.

---

## Итог по severity
- blocker: 1
- major: 6
- minor: 4

Всего находок: 11.
