# Ревью MR: отчёты по клиентам и счета

Масштаб: 40 тыс. клиентов, 3 млн заказов. ASP.NET Core 8, EF Core 8 + Npgsql 8, конвенций именования (snake_case) и аутентификации в проекте нет.

## Blocker

### B1. Controllers/OrderExportController.cs:15 - SQL-инъекция через `FromSqlRaw`
`FromSqlRaw($"... status = '{status}'")` - интерполяция в `FromSqlRaw` не параметризуется, `status` из query-строки попадает в SQL как есть. `?status=' OR 1=1; DROP TABLE ...--` исполняется в БД. Нужен `FromSql`/`FromSqlInterpolated` или LINQ `Where(o => o.Status == status)`.
Итог: чтение и порча любых данных БД анонимным запросом.

### B2. Controllers/OrderExportController.cs:15 - запрос не выполнится: таблица `orders` не существует
Без naming-конвенции EF Core + Npgsql создаёт таблицу `"Orders"` и колонку `"Status"` в кавычках (регистрозависимо). Некавыченные `orders`/`status` Postgres приводит к нижнему регистру -> `42P01 relation "orders" does not exist`.
Итог: выгрузка для бухгалтерии всегда отвечает 500. Лечится тем же переходом на LINQ из B1.

### B3. Controllers/OrderExportController.cs:14-24 - выгрузка без предела, целиком в память
Без фильтра по дате и без пагинации (`status` необязателен по сути - статус "Completed" это почти вся таблица): до 3 млн строк материализуются списком, затем весь CSV собирается в `StringBuilder`, затем копируется в `byte[]` (`Encoding.UTF8.GetBytes`) - три копии данных в памяти на запрос, LOH, длинный запрос к БД. Нужен предел (диапазон дат обязателен) и потоковая запись CSV в `Response.Body` из `AsAsyncEnumerable()` с проекцией нужных колонок вместо `SELECT *`.
Итог: сотни МБ на запрос, пара параллельных выгрузок - OOM/пауза GC всего процесса.

### B4. Controllers/CustomerReportsController.cs:25-26 - вся таблица заказов в память ради счёта
`db.Orders.ToListAsync()` тянет все 3 млн заказов (через lazy-прокси, с трекингом) и фильтрует/считает в памяти. Нужно `CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)` на стороне БД.
Итог: каждый вызов сводки - полное чтение таблицы и гигабайты аллокаций; эндпоинт кладёт сервис и БД.

### B5. Controllers/CustomerReportsController.cs:28 - сериализация lazy-графа: цикл и 500 на каждом клиенте с заказами
`JsonSerializer.Serialize(orders)` обходит навигации lazy-прокси: `Order.Customer` -> `Customer.Orders` -> `Order.Customer` ... System.Text.Json по умолчанию (без `ReferenceHandler`) бросает `JsonException` (object cycle / глубина 64). Попутно lazy loading дочитывает `Customer` вместе с `Photo` и заказы. Аргумент вычисляется всегда, до проверки уровня `Debug` (интерполяция в `LogDebug`), то есть и в проде.
Итог: `Summary` падает 500 для любого клиента, у которого есть заказ. Дополнительно: при исправлении цикла в лог уйдут PII (email, заметки, фото). Убрать сериализацию; если лог нужен - шаблон `LogDebug("... {CustomerId} {OrderCount}", ...)`.

### B6. Services/CurrencyConverter.cs:15-17 - сетевой вызов под глобальным локом, sync-over-async
`CurrencyConverter` - singleton (Program.cs:13), `lock (_sync)` один на процесс, внутри - HTTP-запрос к сервису курсов через `.GetAwaiter().GetResult()`. Все конвертации всех запросов выстраиваются в очередь за одним HTTP-вызовом, каждый ждущий держит поток пула. Таймаут `HttpClient` по умолчанию 100 с (Program.cs:11-12 его не задаёт): одно подвисание сервиса курсов - все `total-in` висят до 100 с последовательно, пул потоков голодает и тянет за собой остальные эндпоинты.
Итог: пропускная способность `total-in` = 1 / latency сервиса курсов, при деградации сервиса курсов - деградация всего API. Нужны async-метод без лока (счётчик уже атомарен через `Interlocked` - инкремент тоже сделать `Interlocked.Increment`), кэш курсов с TTL, явный таймаут.

### B7. Все контроллеры / Program.cs - нет аутентификации и авторизации
В Program.cs нет `AddAuthentication`/`UseAuthorization`, на контроллерах нет `[Authorize]`. Анонимно доступны: список email всех согласившихся на рассылку (CustomerReportsController.cs:40), выгрузка заказов (OrderExportController.cs:11), счёт любого заказа по перебору `orderId` (InvoiceController.cs:16), сводка любого клиента (CustomerReportsController.cs:13).
Итог: утечка персональных данных 40 тыс. клиентов и финансовых данных, IDOR по id.

## Major

### M1. Program.cs:9 + Controllers/CustomerReportsController.cs:19-22 - N+1 через lazy loading
`UseLazyLoadingProxies()` включён глобально; в `Summary` `order.Lines` в цикле - отдельный запрос на каждый заказ клиента. Сумма к тому же считается в памяти. Нужна агрегация в БД: `db.OrderLines.Where(l => l.Order.CustomerId == customerId).SumAsync(l => l.Quantity * l.UnitPrice)`. Глобальный lazy loading стоит выключить: он делает N+1 невидимым в коде по всему сервису (B5 - его же следствие).
Итог: у клиента с сотнями заказов - сотни запросов на один вызов сводки.

### M2. Controllers/CustomerReportsController.cs:8,30 - денежная сумма приводится к `int`
`LinesTotal` объявлен `int`, `(int)linesTotal` отбрасывает копейки; при сумме > 2 147 483 647 явное приведение `decimal` -> `int` бросает `OverflowException`.
Итог: неверные суммы в отчёте, на крупном клиенте - 500. Тип `decimal`.

### M3. Controllers/CustomerReportsController.cs:41-48 - `pageSize` без верхней границы, загрузка целых сущностей ради email
`pageSize` задаёт клиент без ограничения (`pageSize=1000000` - вся таблица), а `ToListAsync()` на полной сущности тянет `Photo` (`byte[]`) и `Notes` каждого клиента ради одного поля `Email`. Нужны `Select(c => c.Email)` до материализации и потолок `pageSize`. Отрицательный `page` даёт отрицательный `OFFSET` -> ошибка Postgres -> 500.
Итог: одна страница по 500 клиентов с фото - десятки МБ из БД; запрос с большим `pageSize` читает всех клиентов с фото.

### M4. Controllers/InvoiceController.cs:22 - `.Result` в async-экшене
Блокирующее ожидание HTTP-вызова держит поток пула на всё время запроса к сервису курсов (до 100 с таймаута по умолчанию). Нужен `await`.
Итог: голодание пула потоков под нагрузкой, рост latency всех эндпоинтов.

### M5. Controllers/InvoiceController.cs:24-33 - `IQueryable` под типом `IEnumerable`, два обхода = два запроса
`rows` - отложенный запрос, объявленный как `IEnumerable`: `rows.Sum(...)` (стр. 28) выполняет его и суммирует в памяти (`Enumerable.Sum`), `pdfRenderer.Render` (стр. 33) выполняет его второй раз. Два запроса к БД, и между ними строки могут измениться - итог в PDF не совпадёт с суммой строк. Материализовать один раз (`ToListAsync`) и считать сумму по списку.
Итог: двойная нагрузка на БД и потенциально расходящийся итог в финансовом документе.

### M6. Controllers/InvoiceController.cs:31 - падение при отсутствии каталога вложений, материализация ради наличия
`Directory.EnumerateFiles` бросает `DirectoryNotFoundException`, если каталога `{Root}/{orderId}` нет - а у заказа без вложений его, как правило, нет. Кроме того, `.ToList().Count > 0` перечисляет весь каталог ради проверки наличия - нужно `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`.
Итог: счёт для заказа без вложений отвечает 500.

### M7. Services/Checksum.cs:14-18 - P/Invoke на каждый байт
`Crc32` вызывается через натив-границу для каждого байта PDF - миллионы переходов managed/native (с маршалингом массива) на мегабайтный документ. zlib `crc32` принимает весь буфер одним вызовом; в .NET есть и управляемая реализация `System.IO.Hashing.Crc32` (NuGet), без нативной зависимости.
Итог: расчёт контрольной суммы на порядки медленнее одного вызова, CPU на потоке пула.

### M8. Services/Checksum.cs:7-8 - непереносимая сигнатура и имя библиотеки
`uLong` в zlib - C `unsigned long`: 64 бита на Linux x64, 32 бита на Windows; `ulong` в C# корректен только для первого. Имя `"libz"` резолвится в `libz.so`, который на runtime-образах без dev-пакета отсутствует (есть только `libz.so.1`) -> `DllNotFoundException` в проде.
Итог: счёт падает 500 на части окружений; лечится переходом на управляемую реализацию (см. M7).

### M9. Services/PdfRenderer.cs:11-22 - результат не является PDF
Файл - строка `%PDF-1.7` и следом plain text, без объектов, xref и trailer. Отдаётся с `application/pdf` (InvoiceController.cs:40).
Итог: у клиента/бухгалтерии счёт не откроется в PDF-просмотрщике. Нужна библиотека генерации PDF, либо MR не заявлять как "PDF-счёт".

### M10. Services/RateService.cs:14 + Controllers/InvoiceController.cs:22, Services/CurrencyConverter.cs:17 - курс запрашивается по HTTP на каждый запрос, без кэша и таймаута
Каждый счёт и каждый `total-in` - внешний HTTP-вызов за курсом, который меняется раз в день/час. Таймаут не задан (100 с по умолчанию), политики повторов нет. `currency` из query подставляется в путь без валидации (`rates/{currency}`: `../...` уходит на другие пути сервиса курсов), `dto!` - `NullReferenceException` при ответе `null`.
Итог: latency и доступность счётов привязаны к внешнему сервису; при его сбое - каскад (см. B6, M4). Кэш курсов с TTL, таймаут, валидация кода валюты (ISO 4217, 3 буквы).

## Minor

### m1. Controllers/InvoiceController.cs:35-37 - копия буфера ради чтения его части
`new byte[pdf.Length - HeaderSize]` + `Array.Copy` копирует почти весь PDF только чтобы посчитать от него хеш; копия не изменяется. Передать срез `pdf.AsSpan(PdfRenderer.HeaderSize)` (для `System.IO.Hashing.Crc32.HashToUInt32(ReadOnlySpan<byte>)` - напрямую).
Итог: лишняя аллокация размером с документ на каждый счёт, на крупных PDF - LOH.

### m2. Controllers/InvoiceController.cs:37 - `Task.Run` для CPU-работы в ASP.NET Core
Перенос вычисления с одного потока пула на другой ничего не освобождает, только добавляет переключение и нагрузку на пул.
Итог: накладные расходы без выигрыша; вызвать синхронно.

### m3. Controllers/CustomerReportsController.cs:16 - полная сущность клиента ради `Id` и `Name`
Загружаются `Photo` и `Notes`, используются только два поля. Проекция `Select(c => new { c.Id, c.Name })` (и `AsNoTracking`).
Итог: лишний трафик из БД на каждый вызов сводки.

### m4. Controllers/CustomerReportsController.cs:36-37 - проверка наличия через счёт
`CountAsync(...) > 0` считает все заказы клиента; `AnyAsync` остановится на первом (`EXISTS`).
Итог: лишняя работа БД на клиентах с большим числом заказов.

### m5. Services/PdfRenderer.cs:18-19, Controllers/OrderExportController.cs:22 - числа форматируются текущей культурой
Интерполяция `decimal` использует `CultureInfo.CurrentCulture`: на хосте с ru-культурой разделитель - запятая. В CSV с `;` это не ломает колонки, но бухгалтерский импорт получит разный формат в зависимости от окружения.
Итог: неконсистентный формат сумм в выгрузке и счёте. `CultureInfo.InvariantCulture` или явный формат.

### m6. Services/CurrencyConverter.cs:19, Controllers/InvoiceController.cs:26 - банковское округление денег
`Math.Round(x, 2)` по умолчанию `MidpointRounding.ToEven` (0.125 -> 0.12). Для счетов обычно требуется `AwayFromZero`; нужно сверить с правилом бухгалтерии.
Итог: расхождения в копейку со сторонними расчётами.

### m7. Controllers/CustomerReportsController.cs:24,26 - `since` сравнивается без учёта `DateTimeKind`
Значение из query без смещения (`?since=2026-09-01T00:00`) приходит `Unspecified`, `CreatedAt` из `timestamptz` - `Utc`; сравнение `DateTime` игнорирует `Kind`, и граница окна трактуется как UTC молча, хотя клиент мог иметь в виду локальное время. После переноса фильтра в БД (B4) Npgsql 6+ бросит исключение на `Unspecified` при сравнении с `timestamptz`.
Итог: неверный подсчёт "недавних" заказов, после исправления B4 - 500 на запросе с `since` без `Z`. Приводить к UTC явно.
