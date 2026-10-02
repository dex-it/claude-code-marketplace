# Ревью MR: отчёты по клиентам и счета

Контекст нагрузки: 40 тыс. клиентов, 3 млн заказов, ASP.NET Core 8, EF Core 8 + Npgsql 8.

Итого: blocker - 4, major - 11, minor - 8.

## Blocker

### 1. Controllers/OrderExportController.cs:15 - SQL-инъекция
`FromSqlRaw($"SELECT * FROM orders WHERE status = '{status}'")`: значение `status` из query-строки подставляется в SQL текстом. `FromSqlRaw` не параметризует интерполированную строку, она уже собрана до вызова.
Чем кончится: `?status=' OR 1=1 --` выгружает все заказы, через `;`/подзапросы доступны чтение других таблиц и порча данных.
Правка: LINQ `db.Orders.Where(o => o.Status == status)` или `FromSql($"... {status}")` (параметризуется).

### 2. Controllers/CustomerReportsController.cs:25-26 - вся таблица заказов в память на каждый запрос
`db.Orders.ToListAsync()` без фильтра грузит все 3 млн заказов (со всеми колонками, под трекингом), затем `Count` фильтрует в памяти.
Чем кончится: каждый вызов сводки - полный скан таблицы, сотни МБ аллокаций и трекинга, секунды-десятки секунд ответа; несколько параллельных вызовов кладут под по памяти и нагружают БД.
Правка: `await db.Orders.CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`. При переносе в БД учесть `DateTimeKind`: `since` из query придёт `Unspecified`, а Npgsql 6+ для `timestamptz` такой параметр отвергает - нормализовать к UTC.

### 3. Controllers/CustomerReportsController.cs:28 - сериализация в лог вычисляется всегда и роняет эндпоинт
Интерполированная строка собирается до проверки уровня, поэтому `JsonSerializer.Serialize(orders)` выполняется и на проде с уровнем Information.
Чем кончится: (а) `orders` - lazy-loading прокси: сериализатор идёт по `Order.Customer -> Customer.Orders -> Order.Customer ...`, догружая навигации запросами (N+1 ещё раз, включая `Photo`), и упирается в цикл - `JsonException: A possible object cycle was detected`; эндпоинт отвечает 500 на любом клиенте с заказами. (б) Даже без цикла - сериализация всех заказов клиента на каждый запрос. (в) В лог уходят PII (email, заметки, фото клиента).
Правка: убрать сериализацию сущностей; структурный шаблон `logger.LogDebug("Summary for customer {CustomerId}: {OrderCount}", customerId, count)`; тяжёлый аргумент - только под `logger.IsEnabled(LogLevel.Debug)`.

### 4. Services/CurrencyConverter.cs:15-17 - глобальный lock вокруг синхронного HTTP-вызова
`CurrencyConverter` - singleton (Program.cs:13), внутри `lock (_sync)` выполняется `GetRateAsync(...).GetAwaiter().GetResult()` - сетевой вызов к сервису курсов, у `HttpClient` таймаут по умолчанию 100 с.
Чем кончится: все запросы `total-in` во всём процессе выстраиваются в одну очередь за сетевым вызовом; каждый ждущий держит поток пула (sync-over-async + блокировка на мониторе). Одна задержка сервиса курсов -> очередь потоков -> thread pool starvation, деградирует весь сервис, не только этот эндпоинт.
Правка: async-метод без lock (`await rates.GetRateAsync(...)`), счётчик через `Interlocked.Increment`; курсы кешировать с TTL; таймаут у HttpClient.

## Major

### 5. Controllers/CustomerReportsController.cs:19-22 - N+1 через lazy loading и агрегация в памяти
Все заказы клиента грузятся целиком, затем `order.Lines` на каждой итерации - отдельный запрос (lazy proxy).
Чем кончится: клиент с 1000 заказов = 1001 запрос к БД на одну сводку; плюс материализация всех строк ради одной суммы.
Правка: `await db.OrderLines.Where(l => l.Order.CustomerId == customerId).SumAsync(l => l.Quantity * l.UnitPrice)` - одна агрегация в БД.

### 6. Controllers/CustomerReportsController.cs:16 - загрузка сущности с `Photo` ради `Id`/`Name`
`FirstOrDefaultAsync` тянет все колонки `Customer`, включая `byte[] Photo` и `Notes`.
Чем кончится: на каждый вызов сводки из БД читается и аллоцируется фото клиента (потенциально сотни КБ, LOH), при том что нужны два поля.
Правка: проекция `Select(c => new { c.Id, c.Name })`.

### 7. Controllers/CustomerReportsController.cs:43-49 - список рассылки грузит полные сущности ради email
`ToListAsync()` по `Customer` целиком (с `Photo`, `Notes`, под трекингом), затем в памяти берётся только `Email`.
Чем кончится: страница 500 клиентов = 500 фото в памяти и в трафике БД; при `pageSize`, заданном клиентом крупно (см. п. 23), - вся база клиентов с фото за один запрос.
Правка: `.Select(c => c.Email).ToListAsync()`.

### 8. Controllers/OrderExportController.cs:14-24 - выгрузка без предела и целиком в памяти
Все заказы статуса (для частого статуса - миллионы строк) материализуются списком, затем CSV собирается в `StringBuilder`, затем `ToString()` и `GetBytes` - ещё две полные копии.
Чем кончится: выгрузка «completed» за всё время = миллионы сущностей + три копии многомегабайтного текста в LOH; OOM/долгие GC-паузы на поде, таймаут запроса.
Правка: фильтр по периоду и/или пагинация; проекция нужных колонок; потоковая запись в `Response.Body` через `AsAsyncEnumerable()` и `StreamWriter`.

### 9. Controllers/OrderExportController.cs:15 - имена таблицы и колонок не совпадают с дефолтной схемой EF (условно)
В `OrdersDbContext` нет ни `ToTable`, ни конвенции snake_case, значит при миграциях по умолчанию таблица `"Orders"` и колонка `"Status"` - в кавычках, регистрозависимы. Неквотированные `orders`/`status` Postgres приводит к нижнему регистру.
Чем кончится: если схема создана миграциями EF по умолчанию - `42P01: relation "orders" does not exist`, эндпоинт всегда 500. Если схема snake_case - `SELECT *` отдаст `customer_id`, `created_at`, и EF не сопоставит их со свойствами `CustomerId`/`CreatedAt`.
Правка: снимается переходом на LINQ из п. 1. Проверить, как реально названа схема в БД.

### 10. Controllers/InvoiceController.cs:22 - sync-over-async `.Result`
`rates.GetRateAsync("EUR").Result` блокирует поток запроса на время HTTP-вызова в async-действии.
Чем кончится: под нагрузкой потоки пула заняты ожиданием сети -> starvation, рост латентности всего сервиса; исключение приходит обёрнутым в `AggregateException`.
Правка: `await rates.GetRateAsync("EUR")`; курс EUR кешировать.

### 11. Controllers/InvoiceController.cs:24-28, 33 - `IQueryable` под `IEnumerable`: два синхронных запроса к БД
`rows` - неисполненный запрос. `rows.Sum(...)` (стр. 28) исполняет его синхронно, `pdfRenderer.Render` (стр. 33, цикл в PdfRenderer.cs:17) - ещё раз.
Чем кончится: два обращения к БД на один счёт, оба синхронные (блокировка потока в async-методе); между обходами данные могут измениться - итог в PDF не совпадёт со строками.
Правка: один `await ...ToListAsync()`, сумма по материализованному списку.

### 12. Controllers/InvoiceController.cs:31 - падение при отсутствии каталога вложений и лишняя материализация
`Directory.EnumerateFiles` бросает `DirectoryNotFoundException`, если у заказа нет каталога вложений; `.ToList().Count > 0` перечисляет все файлы ради проверки наличия.
Чем кончится: счёт по заказу без вложений (вероятно, большинство) - 500. Для каталога с большим числом файлов - лишний обход ФС синхронно в запросе.
Правка: `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`.

### 13. Services/Checksum.cs:7-8 - P/Invoke `libz` не переносим
(а) Имя `"libz"` разрешается в `libz.so`, а в runtime-образах (в т.ч. `mcr.microsoft.com/dotnet/aspnet`) обычно есть только `libz.so.1`, `libz.so` ставится dev-пакетом. (б) Параметр `uLong` в zlib - C `unsigned long`: 64 бита на Linux x64, 32 бита на Windows; объявление через `ulong` на Windows ломает сигнатуру.
Чем кончится: `DllNotFoundException` на каждом счёте в контейнере без dev-пакета - эндпоинт счетов неработоспособен; на Windows - неверная контрольная сумма.
Правка: управляемый `System.IO.Hashing.Crc32` (NuGet `System.IO.Hashing`) вместо натив-вызова.

### 14. Program.cs:9 - `UseLazyLoadingProxies` на весь контекст
Глобально включённый lazy loading делает любую навигацию в цикле скрытым запросом; в этом же MR он уже дал N+1 (п. 5) и циклическую сериализацию (п. 3).
Чем кончится: N+1 будут появляться незаметно в каждом новом коде; дополнительно синхронные запросы к БД при обращении к навигации из async-кода.
Правка: убрать прокси, загружать явно (`Include`/проекции).

### 15. Program.cs:5-19 - нет аутентификации и авторизации
Ни `AddAuthentication`/`AddAuthorization`, ни `[Authorize]` на контроллерах.
Чем кончится: любой, кто достучится до сервиса, выгружает email всех клиентов, давших согласие на рассылку (`mailing-list`), счета и сводки по любому `orderId`/`customerId` перебором (IDOR), экспорт заказов для бухгалтерии.
Правка: подключить схему аутентификации сервиса, политики на эндпоинты, проверку принадлежности ресурса.

## Minor

### 16. Services/Checksum.cs:13-18 - натив-вызов на каждый байт
`Crc32` вызывается через P/Invoke по одному байту; zlib принимает буфер целиком.
Чем кончится: число переходов managed->native равно размеру PDF; на крупном счёте - лишние миллисекунды CPU на запрос. Снимается правкой п. 13; если натив остаётся - один вызов на весь буфер.

### 17. Controllers/InvoiceController.cs:35-36 - копия буфера PDF ради хеша
`body` - полная копия PDF без заголовка только чтобы посчитать CRC; копия не изменяется.
Чем кончится: лишняя аллокация размером с PDF на каждый счёт (крупные - в LOH).
Правка: `pdf.AsSpan(PdfRenderer.HeaderSize)` в `Checksum.Compute(ReadOnlySpan<byte>)`.

### 18. Controllers/InvoiceController.cs:37 - `Task.Run` в обработчике запроса
Перенос CPU-работы на другой поток пула в ASP.NET ничего не разгружает: запрос всё равно ждёт, добавляется переключение и лишняя задача.
Правка: вызывать синхронно.

### 19. Controllers/CustomerReportsController.cs:36-37 - `CountAsync() > 0` вместо `AnyAsync()`
Считаются все заказы клиента ради проверки наличия.
Чем кончится: `COUNT(*)` по всем заказам клиента вместо `EXISTS` с остановкой на первой строке.
Правка: `await db.Orders.AnyAsync(o => o.CustomerId == customerId)`.

### 20. Controllers/CustomerReportsController.cs:8, 30 - денежная сумма усекается до `int`
`LinesTotal` объявлен `int`, `(int)linesTotal` отбрасывает копейки; при сумме > `int.MaxValue` явное приведение `decimal -> int` бросает `OverflowException`.
Чем кончится: неверная сумма в отчёте; для крупного клиента - 500.
Правка: `decimal LinesTotal`.

### 21. Services/RateService.cs:12-15 - нет кеша курсов, таймаута и проверки ответа
Курс запрашивается по сети на каждый счёт и каждую конвертацию; таймаут по умолчанию 100 с; `dto!` - при пустом/`null` ответе `NullReferenceException`.
Правка: кеш курса с TTL, явный таймаут в `AddHttpClient`, проверка `dto` с осмысленной ошибкой.

### 22. Controllers/OrderExportController.cs:22 - формат CSV зависит от культуры и не экранирует поля
`{o.Total}` форматируется текущей культурой процесса (запятая или точка как разделитель дробной части в зависимости от окружения); `Number` не экранируется - `;` или перевод строки в номере ломает файл.
Чем кончится: бухгалтерия получает файл, формат которого меняется от настроек пода.
Правка: `CultureInfo.InvariantCulture`, экранирование полей по RFC 4180.

### 23. Controllers/CustomerReportsController.cs:41 - параметры пагинации без валидации
`pageSize` без верхней границы, `page` может быть отрицательным.
Чем кончится: `pageSize=1000000` выгружает всю базу клиентов (с фото, п. 7) одним запросом; отрицательный `page` - отрицательный `OFFSET`, ошибка БД и 500.
Правка: ограничить `pageSize` (например, 1..1000), `page >= 0`, иначе 400.
