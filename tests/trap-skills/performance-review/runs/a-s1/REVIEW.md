# Ревью MR: отчёты по клиентам и счета

Контекст: прод, 40 тыс. клиентов, 3 млн заказов, PostgreSQL через Npgsql EF Core 8. Весь каталог - новый код.

Итог: 5 blocker, 11 major, 9 minor.

## Blocker

### B1. Controllers/OrderExportController.cs:15 - SQL-инъекция через `FromSqlRaw` с интерполяцией
`FromSqlRaw($"... WHERE status = '{status}'")` подставляет `status` из query-строки прямо в текст SQL. `FromSqlRaw` не параметризует интерполяцию: параметризует только `FromSql`/`FromSqlInterpolated`.
Чем кончится: `?status=x' OR '1'='1` выгружает все заказы, `'; DROP TABLE ...; --` и прочее - произвольный SQL с правами сервиса.
Исправление: LINQ `db.Orders.Where(o => o.Status == status)` либо `FromSql($"...{status}")`.

### B2. Controllers/CustomerReportsController.cs:25-26 - вся таблица заказов в память ради одного счётчика
`db.Orders.ToListAsync()` без фильтра грузит все 3 млн заказов (с трекингом), затем `Count` с предикатом считается в памяти.
Чем кончится: каждый вызов сводки - полный скан, сотни МБ-гигабайты на запрос, долгие GC-паузы, при параллельных вызовах - OOM процесса.
Исправление: `await db.Orders.CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`. При переносе в БД учесть: `since` приходит с `DateTimeKind.Unspecified`, а Npgsql 6+ с колонкой `timestamptz` такой параметр отвергает - нормализовать в UTC на входе.

### B3. Controllers/CustomerReportsController.cs:28 - сериализация графа с циклом в `LogDebug` на каждом вызове
Интерполированная строка вычисляется до проверки уровня лога, поэтому `JsonSerializer.Serialize(orders)` выполняется всегда, даже когда Debug выключен. Граф цикличен: `Customer` загружен на строке 16, при загрузке заказов fixup связывает `Order.Customer -> Customer.Orders -> Order ...`, плюс ленивые прокси дотягивают `Lines`. `System.Text.Json` без `ReferenceHandler` на таком графе бросает `JsonException` (object cycle / max depth 64).
Чем кончится: эндпоинт сводки отвечает 500 на любом клиенте с хотя бы одним заказом. Если цикл разорвать - остаётся N+1 на `Lines` ради лога, сериализация всех заказов на каждом запросе и утечка в логи персональных данных (email, notes, фото клиента base64).
Исправление: убрать дамп сущностей; структурный лог `logger.LogDebug("Summary for customer {CustomerId}", customerId)` с шаблоном вместо интерполяции.

### B4. Services/CurrencyConverter.cs:15-17 - HTTP-вызов под глобальным `lock` в singleton, sync-over-async
`CurrencyConverter` - singleton, `lock (_sync)` охватывает сетевой вызов `GetRateAsync(...).GetAwaiter().GetResult()`. Все конвертации процесса выстраиваются в очередь на один лок, каждый ожидающий держит заблокированный поток пула. У HttpClient таймаут по умолчанию 100 с (в Program.cs не переопределён).
Чем кончится: пропускная способность `total-in` - один запрос за раз на весь процесс; при медленном сервисе курсов потоки пула кончаются (thread-pool starvation), и встаёт весь API, не только этот эндпоинт.
Исправление: `ConvertAsync` с `await`, лок не нужен вовсе (счётчик - `Interlocked.Increment`), курс кэшировать с TTL.

### B5. Program.cs:5-19, все контроллеры - нет аутентификации и авторизации
В пайплайне нет `AddAuthentication`/`AddAuthorization`, на контроллерах нет `[Authorize]`. Эндпоинты отдают персональные и финансовые данные по перебираемым int-идентификаторам.
Чем кончится: `api/customers/mailing-list` постранично отдаёт email всей базы клиентов любому анонимному вызову; `api/orders/export` - бухгалтерскую выгрузку; `api/orders/{id}/invoice` - счёт любого заказа перебором id (IDOR). Утечка PII - регуляторный инцидент.
Исправление: аутентификация + политики на каждый эндпоинт, проверка принадлежности заказа/клиента вызывающему.

## Major

### M1. Controllers/OrderExportController.cs:15 - сырой SQL не совпадает со схемой, запрос падает
EF Core с Npgsql без snake_case-конвенции создаёт таблицу `"Orders"` и колонку `"Status"` в кавычках (регистр значим). Некавыченные `orders` и `status` в Postgres приводятся к нижнему регистру - таких объектов нет.
Чем кончится: `42P01 relation "orders" does not exist` - выгрузка не работает ни при каком входе (если только в проекте нет ручной схемы в нижнем регистре - в MR её нет). Лечится тем же переходом на LINQ, что и B1.

### M2. Controllers/OrderExportController.cs:14-24 - выгрузка без предела, целиком в память, двойная копия
Выгрузка по статусу без пагинации и без проекции (`SELECT *`), затем весь CSV строится в `StringBuilder` и ещё раз копируется в `byte[]` через `Encoding.UTF8.GetBytes`.
Чем кончится: для массового статуса (например, «выполнен» на миллионы строк) - память = сущности + строка CSV + массив байт одновременно, OOM или минуты ответа и таймаут у клиента.
Исправление: проекция на пять нужных полей, `AsAsyncEnumerable()` и запись в `Response.Body` потоком (StreamWriter), фильтр по периоду для бухгалтерии.

### M3. Controllers/CustomerReportsController.cs:19-22 - N+1 через ленивые навигации и агрегат в памяти
Цикл по заказам клиента обращается к `order.Lines` - ленивая прокси делает отдельный запрос на каждый заказ. Сумма считается в памяти, хотя это `SUM` в БД.
Чем кончится: у клиента с 1000 заказов - 1001 запрос на один вызов сводки, латентность линейна от истории клиента.
Исправление: `await db.OrderLines.Where(l => l.Order.CustomerId == customerId).SumAsync(l => l.Quantity * l.UnitPrice)`.

### M4. Controllers/CustomerReportsController.cs:8,30 - денежная сумма обрезается до `int`
`LinesTotal` объявлен `int`, `(int)linesTotal` отбрасывает копейки; при сумме больше `int.MaxValue` явное приведение `decimal -> int` бросает `OverflowException`.
Чем кончится: неверные суммы в отчёте (систематически занижены), для крупных B2B-клиентов - 500.
Исправление: `decimal LinesTotal`.

### M5. Controllers/InvoiceController.cs:31 - `DirectoryNotFoundException` для заказа без вложений
`Directory.EnumerateFiles` на несуществующем каталоге бросает исключение, а каталог `Attachments:Root/{orderId}` у заказа без вложений, скорее всего, не создан. Плюс `ToList().Count > 0` материализует весь список ради факта наличия, синхронный I/O на потоке запроса.
Чем кончится: счёт по заказу без вложений - 500.
Исправление: `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`.

### M6. Controllers/InvoiceController.cs:22 - `.Result` в async-действии
Синхронное ожидание HTTP-вызова курса блокирует поток пула на время сетевого вызова.
Чем кончится: под нагрузкой - thread-pool starvation, рост латентности всего сервиса.
Исправление: `await rates.GetRateAsync("EUR")`.

### M7. Controllers/InvoiceController.cs:24-33 - `IQueryable` под типом `IEnumerable` обходится дважды
`rows` - неисполненный запрос. `rows.Sum(...)` выполняет его первый раз, `pdfRenderer.Render` перечисляет второй раз - второй SQL-запрос.
Чем кончится: два round-trip на счёт; если строки заказа изменятся между запросами, итог в PDF не совпадёт со строками - в бухгалтерском документе.
Исправление: `var rows = await ...ToListAsync();` один раз, сумма по материализованному списку.

### M8. Services/Checksum.cs:14-18 - P/Invoke на каждый байт
`crc32` из zlib вызывается по одному байту в цикле: переход managed->native и маршалинг массива на каждый байт PDF.
Чем кончится: на PDF в сотни КБ - сотни тысяч переходов границы на запрос, CPU уходит на маршалинг; checksum становится самым дорогим шагом счёта.
Исправление: один вызов на весь буфер `Crc32(0, data, (uint)data.Length)`, либо managed `System.IO.Hashing.Crc32` без натива вовсе.

### M9. Services/Checksum.cs:7-8 - сигнатура P/Invoke и имя библиотеки непереносимы
zlib объявляет `uLong crc32(uLong, const Bytef*, uInt)`; `uLong` - C `unsigned long`: 64 бита на Linux x64, 32 бита на Windows. `ulong` в сигнатуре корректен только на LP64. Имя `libz` резолвится в `libz.so`, который в runtime-образах обычно есть только как `libz.so.1` (симлинк `libz.so` ставит dev-пакет).
Чем кончится: на Windows - мусор в результате, в slim-контейнере - `DllNotFoundException` на первом счёте. Требует сверки с целевым образом.
Исправление: `System.IO.Hashing.Crc32` (managed) вместо P/Invoke.

### M10. Controllers/CustomerReportsController.cs:41-49 - рассылка: полная сущность ради email и неограниченный `pageSize`
Грузится вся сущность `Customer` вместе с `Photo` (`byte[]`) и `Notes`, хотя нужен только `Email`. `pageSize` задаёт клиент без верхней границы.
Чем кончится: страница в 500 клиентов тянет 500 фотографий из БД; `pageSize=1000000` выгружает всю базу разом (в сочетании с B5 - одним анонимным запросом).
Исправление: `.Select(c => c.Email)` до `ToListAsync`, `pageSize` зажать сверху (например, 1000), `page`/`pageSize` проверить на отрицательные и на переполнение `page * pageSize`; для обхода всей базы - keyset-пагинация по `Id` вместо `Skip`.

### M11. Services/RateService.cs:14 - `currency` из запроса без валидации в путь внешнего запроса
`currency` из query подставляется в относительный URI `rates/{currency}` без экранирования и проверки по списку ISO-кодов.
Чем кончится: `currency=../admin/...` или `?x=` меняют путь/параметры запроса к сервису курсов (path traversal в пределах его хоста); пустой/неизвестный код - исключение и 500 вместо 400.
Исправление: проверка `^[A-Z]{3}$` на входе контроллера, `Uri.EscapeDataString`.

## Minor

### m1. Program.cs:9 - `UseLazyLoadingProxies` глобально
Включает ленивую загрузку для всего контекста: любое обращение к навигации в цикле становится N+1 без видимого запроса в коде (M3 и дотягивание в B3 - прямые следствия). Лучше явный `Include`/проекции.

### m2. Controllers/CustomerReportsController.cs:16 - overfetch клиента
Для сводки нужны `Id` и `Name`, грузится вся строка с `Photo`. Проекция `Select(c => new { c.Id, c.Name })`.

### m3. Controllers/CustomerReportsController.cs:19,25 - чтение без `AsNoTracking`
Сущности только читаются, но попадают в change tracker - лишняя память и время snapshot'ов (особенно с B2).

### m4. Controllers/CustomerReportsController.cs:36-37 - `CountAsync > 0` вместо `AnyAsync`
`COUNT` сканирует все заказы клиента, `AnyAsync` останавливается на первом.

### m5. Controllers/InvoiceController.cs:35-37 - копия тела PDF и `Task.Run` вокруг CPU
`Array.Copy` в новый массив ради чтения среза - лишняя аллокация размером с PDF; достаточно `ReadOnlySpan<byte>`/`AsSpan(HeaderSize)` (с managed Crc32 из M8). `Task.Run` для CPU-счёта в хендлере не освобождает ресурсы - занимает другой поток пула плюс переключение.

### m6. Controllers/InvoiceController.cs:26, Services/CurrencyConverter.cs:19 - банковское округление денег
`Math.Round(x, 2)` по умолчанию `MidpointRounding.ToEven`: 0.125 -> 0.12. Для бухгалтерских документов обычно требуется `AwayFromZero`; кроме того, сумма округлённых строк может не совпасть с округлённой суммой заказа. Нужно решение, какое правило принято.

### m7. Services/RateService.cs:15, Services/CurrencyConverter.cs:19, Controllers/InvoiceController.cs:26 - нет защиты от пустого/нулевого курса
`dto!` при ответе `null` даёт `NullReferenceException`, курс `0` - `DivideByZeroException`. Оба - 500 без внятной причины. Плюс HttpClient курсов без таймаута и resilience-политики (Program.cs:11-12), курс не кэшируется - внешний вызов на каждый запрос.

### m8. Services/CurrencyConverter.cs:12 - scope на каждую конвертацию
Singleton создаёт DI-scope на каждый вызов ради получения typed client. Проще сделать конвертер scoped/transient и внедрить `IRateService` напрямую - это же убирает необходимость в singleton-состоянии из B4.

### m9. Controllers/OrderExportController.cs:22 - формат CSV зависит от культуры и не экранирует поля
`{o.Total}` форматируется в `CurrentCulture` (в ru-культуре десятичная запятая), `Number` с `;` или переводом строки ломает строку файла. Для выгрузки в бухгалтерию - `CultureInfo.InvariantCulture` и экранирование полей (или CSV-библиотека).
