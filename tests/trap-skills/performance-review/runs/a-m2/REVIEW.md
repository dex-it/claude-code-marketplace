# Ревью MR: отчёты по клиентам и счета

Контекст: прод, 40 тыс. клиентов, 3 млн заказов; EF Core 8 + Npgsql 8, `UseLazyLoadingProxies` включён глобально.

## Blocker

### 1. Controllers/CustomerReportsController.cs:25-26 - вся таблица заказов в память
`db.Orders.ToListAsync()` без фильтра тянет все 3 млн строк с трекингом (и lazy-прокси), затем `Count` считается в памяти.
Итог: каждый запрос сводки - секунды-минуты на выборку, сотни МБ-ГБ в куче, LOH/GC-паузы; несколько параллельных вызовов кладут под и БД. Считать на стороне БД: `CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`.

### 2. Controllers/CustomerReportsController.cs:28 - сериализация графа lazy-сущностей в лог
`JsonSerializer.Serialize(orders)` выполняется всегда: интерполированная строка вычисляется до проверки уровня `Debug`. Сериализатор обходит навигации `Order.Customer -> Customer.Orders -> Order...`, lazy-прокси догружают их из БД (плюс `Lines` каждого заказа, плюс `Photo` клиента), а цикл без `ReferenceHandler` заканчивается `JsonException` (object cycle / глубина 64).
Итог: эндпоинт сводки отвечает 500 на любого клиента с заказами; до падения - лавина lazy-запросов. Даже без цикла - PII (email, фото, заметки) в логах. Убрать или логировать структурно скаляры (`customerId`, число заказов) шаблоном сообщения.

### 3. Controllers/OrderExportController.cs:15 - SQL-инъекция
`FromSqlRaw($"... WHERE status = '{status}'")` подставляет параметр запроса в текст SQL. `status=x' OR '1'='1` отдаёт все заказы, `x'; DROP ...`/`UNION SELECT` - чтение и порча произвольных таблиц. Нужен `FromSql`/`FromSqlInterpolated` (параметризация) или обычный LINQ `Where(o => o.Status == status)`.

### 4. Services/CurrencyConverter.cs:15-17 - HTTP-вызов под глобальным локом, sync-over-async
Синглтон держит один `lock` вокруг `GetRateAsync(...).GetAwaiter().GetResult()`. Все запросы `total-in` со всего инстанса сериализуются на одном внешнем HTTP-вызове, каждый ждущий блокирует поток пула.
Итог: пропускная способность = 1 / латентность сервиса курсов; при его тормозах (дефолтный `HttpClient.Timeout` 100 с) очередь потоков растёт, thread pool starvation валит и остальные эндпоинты. Лок нужен только под счётчик (уже есть `Interlocked`) - сделать метод async, `Interlocked.Increment`, без lock; курс кэшировать с TTL.

## Major

### 5. Controllers/CustomerReportsController.cs:19-22 (корень - Program.cs:9) - N+1 через lazy loading
`order.Lines` в цикле по всем заказам клиента: на каждый заказ отдельный запрос. У крупного клиента сотни-тысячи заказов -> столько же round-trip на один вызов. Считать агрегатом в БД: `db.OrderLines.Where(l => l.Order.CustomerId == customerId).SumAsync(l => l.Quantity * l.UnitPrice)`. Глобальный `UseLazyLoadingProxies` делает такие N+1 невидимыми во всём сервисе - стоит отказаться от него в пользу явных `Include`/проекций.

### 6. Controllers/CustomerReportsController.cs:30 - денежная сумма обрезается до int
`(int)linesTotal` отбрасывает копейки (и бросит `OverflowException` при сумме > 2^31), `CustomerSummary.LinesTotal` объявлен `int`. Итог: в отчёте неверные суммы. Тип поля - `decimal`.

### 7. Controllers/CustomerReportsController.cs:41-49 - pageSize без предела и полные сущности
`pageSize` приходит от клиента без ограничения (`pageSize=100000` = все 40 тыс. клиентов за раз), `page` отрицательный -> исключение в `Skip`. Грузятся целые `Customer` с `Photo` (byte[]) и `Notes` ради одного `Email`: при 500 клиентах с фото - десятки МБ на страницу. Нужны `Math.Clamp` для `pageSize`, проверка `page >= 0`, проекция `.Select(c => c.Email)` до `ToListAsync`, `AsNoTracking`.

### 8. Controllers/InvoiceController.cs:22 - `.Result` в async-обработчике
`rates.GetRateAsync("EUR").Result` блокирует поток пула на время внешнего HTTP. Под нагрузкой - starvation. Заменить на `await`.

### 9. Controllers/InvoiceController.cs:24-33 - двойное выполнение запроса строк счёта
`rows` - `IQueryable`, приведённый к `IEnumerable`: `rows.Sum(...)` (стр. 28) выполняет SQL и суммирует в памяти, `pdfRenderer.Render` (стр. 33, `PdfRenderer.cs:17`) выполняет тот же SQL второй раз. Между запросами строки могут измениться - итог в счёте не сойдётся со строками. Материализовать один раз `await ...ToListAsync()` и считать сумму по списку.

### 10. Controllers/InvoiceController.cs:31 - падение без каталога вложений и лишняя материализация
`Directory.EnumerateFiles` бросает `DirectoryNotFoundException`, если у заказа нет каталога вложений - для большинства заказов счёт будет 500. `.ToList().Count > 0` перечисляет весь каталог ради факта наличия. Нужны `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`; синхронный дисковый I/O (часто сетевой том) в обработчике - учесть.

### 11. Services/Checksum.cs:14-17 - P/Invoke на каждый байт
`crc32` из libz вызывается по одному байту: переход managed->native + маршалинг массива на каждый байт PDF. На счёте в сотни КБ - сотни тысяч переходов на запрос. Вызвать один раз на весь буфер (`Crc32(0, data, (uint)data.Length)`) или взять managed `System.IO.Hashing.Crc32`.

### 12. Controllers/OrderExportController.cs:14-24 - выгрузка без предела целиком в память
Для массового статуса (например, завершённые) - миллионы заказов: список сущностей, затем весь CSV в `StringBuilder`, затем копия в `byte[]` через `ToString()`/`GetBytes` - три полных копии, LOH, OOM/таймаут. Нужен стриминг: `AsAsyncEnumerable()` + запись в `Response.Body` (или пагинация/фоновая выгрузка), проекция нужных колонок вместо `SELECT *`.

### 13. Controllers/OrderExportController.cs:15 - имена таблицы и колонки не совпадают со схемой
В `OrdersDbContext` нет snake_case-конвенции: EF создаёт таблицу `"Orders"` и колонку `"Status"` (в кавычках, с регистром). Незакавыченные `orders`/`status` в PostgreSQL сворачиваются в нижний регистр -> `relation "orders" does not exist`. Выгрузка не работает вовсе (при исправлении п.3 на LINQ проблема уходит сама).

### 14. Services/PdfRenderer.cs:14-21 - на выходе не PDF
После сигнатуры `%PDF-1.7` пишется голый UTF-8 текст без объектов, xref и trailer. Файл с `application/pdf` не откроется ни одним просмотрщиком; бухгалтерия получает битые счета. Это заглушка, а MR заявляет PDF-счёт - нужна реальная генерация (библиотека) либо явная пометка фичи как недоделанной.

### 15. Program.cs:15-18, все контроллеры - эндпоинты без авторизации
Нет `AddAuthentication/UseAuthorization` и `[Authorize]`: любой, кто достучался до сервиса, выкачивает email-список 40 тыс. клиентов (`mailing-list`), выгрузку всех заказов и счета по перебору `orderId` (IDOR). Если авторизация делается на шлюзе - это надо подтвердить; иначе утечка PII.

## Minor

### 16. Controllers/CustomerReportsController.cs:16 - overfetch клиента
Грузится вся сущность с `Photo` и `Notes`, используются только `Id` и `Name`. Проекция `Select(c => new { c.Id, c.Name })`.

### 17. Controllers/CustomerReportsController.cs:36-37 - `Count > 0` вместо `Any`
`CountAsync` считает все заказы клиента ради факта наличия; `AnyAsync` останавливается на первой строке.

### 18. Controllers/InvoiceController.cs:35-36 - копия буфера вместо среза
`new byte[]` + `Array.Copy` дублирует весь PDF ради пропуска 8 байт заголовка. Передавать `pdf.AsSpan(HeaderSize)` (managed `Crc32.Hash(ReadOnlySpan<byte>)` его принимает).

### 19. Controllers/InvoiceController.cs:37 - `Task.Run` для CPU-работы в обработчике
Перенос на другой поток пула в ASP.NET Core ничего не даёт, только лишнее переключение. После исправления п.11 CRC дешёвый - считать синхронно.

### 20. Services/Checksum.cs:8 - сигнатура `crc32` зависит от платформы
В zlib параметр и результат - C `unsigned long`: 64 бита на Linux x64, 32 бита на Windows. `ulong` в `DllImport` ломает ABI на Windows; имя `libz` тоже Linux-специфично. Ещё один довод за managed `System.IO.Hashing.Crc32`.

### 21. Services/RateService.cs:14 - курс без кэша и без проверки валюты
Каждый счёт и каждый `total-in` ходит во внешний сервис за курсом, который меняется раз в сутки/час - кэш с TTL снимет нагрузку и латентность. `currency` из запроса подставляется в путь без проверки (`../...` уходит на другой путь того же хоста) - валидировать по ISO 4217 (`^[A-Z]{3}$`). Нет `CancellationToken`.

### 22. Controllers/InvoiceController.cs:26, Services/CurrencyConverter.cs:19 - банковское округление денег
`Math.Round(x, 2)` по умолчанию `MidpointRounding.ToEven`: 0.125 -> 0.12. Для бухгалтерии обычно нужен `AwayFromZero` - сверить с требованием, иначе расхождения на копейку с учётной системой.

### 23. Services/PdfRenderer.cs:18-19 - числа форматируются текущей культурой
`{r.UnitPrice}` в интерполяции зависит от `CurrentCulture` сервера (`12,50` vs `12.50`). Указать `CultureInfo.InvariantCulture` или явный формат.

### 24. Controllers/OrderExportController.cs:22 - CSV без экранирования
`Number` с `;`, `"` или переводом строки ломает структуру файла; значение, начинающееся с `=`/`+`/`@`, исполняется Excel как формула. Экранировать поля по RFC 4180. `Total` форматируется культурой сервера - как в п.23.
