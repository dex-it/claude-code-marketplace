# Ревью MR: отчёты по клиентам и счета (Orders.Api)

Масштаб: 40 тыс. клиентов, 3 млн заказов. Код не правился.

## Blocker

1. **Controllers/CustomerReportsController.cs:25-26** — `db.Orders.ToListAsync()` загружает все 3 млн заказов (с отслеживанием и lazy-прокси) ради подсчёта заказов одного клиента.
   Последствия: сотни МБ или ГБ памяти на каждый запрос, OOM или остановка GC, а одновременные запросы валят процесс.
   Исправление: `CountAsync(o => o.CustomerId == id && o.CreatedAt >= from)`.

2. **Controllers/CustomerReportsController.cs:28** — `JsonSerializer.Serialize(orders)` для сущностей с lazy-прокси.
   Сериализатор обходит `Order.Customer`, затем `Customer.Orders`, затем `Order.Lines`, и каждое обращение запускает ленивую загрузку.
   Последствия: либо `JsonException` из-за цикла Order→Customer→Orders, и эндпоинт стабильно отвечает 500, либо загружается весь граф клиента (N+1 с огромным объёмом).
   Интерполяция в `LogDebug($"...")` вычисляется всегда, даже при выключенном Debug. В лог попадают персональные данные.
   Исправление: убрать строку, либо логировать только id и количество через шаблон `{CustomerId}`.

3. **Controllers/OrderExportController.cs:15** — SQL-инъекция: `FromSqlRaw($"... '{status}'")` подставляет параметр запроса в SQL.
   Последствия: `status=' OR 1=1 --` отдаёт все заказы, а при широких правах БД возможны чтение чужих таблиц и модификация данных.
   Исправление: `FromSql($"... {status}")` или `Where(o => o.Status == status)`.

4. **Controllers/OrderExportController.cs:14-24** — выгрузка без лимита и без стриминга: `ToListAsync` по статусу, затем `StringBuilder`, затем `byte[]`.
   Последствия: для статуса, у которого сотни тысяч или миллионы заказов, в памяти лежат три копии данных (сущности, строка, байты). Это OOM и таймаут. Нужен стриминг (`AsAsyncEnumerable` с записью в `Response.Body`), проекция только нужных колонок и фильтр по периоду.

5. **Controllers/InvoiceController.cs:30-31** — `Directory.EnumerateFiles` бросает `DirectoryNotFoundException`, если каталога вложений нет. Для большинства заказов его нет.
   Последствия: счёт возвращает 500 для всех заказов без вложений. Если `Attachments:Root` не задан, будет `NullReferenceException` из-за `!`.
   Исправление: `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`, а `ToList().Count` заменить на `Any()`.

6. **Services/PdfRenderer.cs:14-21** — это не PDF: после `%PDF-1.7` идёт сплошной UTF-8 текст, без структуры (objects, xref, trailer).
   Последствия: любой PDF-просмотрщик скажет «файл повреждён», а бухгалтерия не откроет счёт. Нужна реальная PDF-библиотека (QuestPDF и т. п.).

7. **Services/Checksum.cs:7-19** — P/Invoke `libz` с вызовом `crc32` на каждый байт.
   - Имя `libz` на Linux обычно разрешается только при наличии `libz.so` (dev-пакета). В slim-образах есть лишь `libz.so.1`, и будет `DllNotFoundException`, то есть 500 на каждом счёте.
   - Сигнатура `ulong` для `uLong` верна только на LP64. На Windows `uLong` 32-битный, и вызов ломается.
   - Вызов на каждый байт стоит ~десятки нс, плюс маршалинг массива. Для счёта в сотни КБ это заметные миллисекунды на запрос.
   Исправление: `System.IO.Hashing.Crc32.Hash(span)`, без нативных зависимостей.

## Major

8. **Controllers/CustomerReportsController.cs:19-22** — N+1: `order.Lines` через lazy-прокси даёт отдельный запрос на каждый заказ клиента.
   Последствия: у клиента с 1000 заказов это 1000 запросов за один вызов. Нужна агрегация в БД: `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`.

9. **Controllers/CustomerReportsController.cs:30** — `(int)linesTotal` обрезает копейки и может переполниться. Сумма денег отдаётся как `int`.
   Последствия: неверные суммы в отчёте. `LinesTotal` нужно сделать `decimal`.

10. **Controllers/InvoiceController.cs:24-33** — `IEnumerable<InvoiceRow> rows` — это отложенный запрос.
    Он выполняется дважды: в `rows.Sum` (стр. 28) и в `Render` (стр. 17 PdfRenderer).
    Последствия: два обращения к БД, а строки и итог могут разойтись, если заказ изменился между ними. Нужен `ToListAsync()` один раз.

11. **Controllers/InvoiceController.cs:22** — `rates.GetRateAsync("EUR").Result` в async-методе (sync-over-async).
    Последствия: блокируется поток пула на каждый счёт, при нагрузке возникает голодание пула. Нужно `await`.
    Курс 0 или отсутствие ответа дают `DivideByZeroException` или NRE (`dto!`). Нужна валидация курса.

12. **Services/CurrencyConverter.cs:12-20** — singleton держит глобальный `lock` на время HTTP-вызова и блокирует поток (`GetAwaiter().GetResult()`).
    Последствия: все конвертации в приложении выстраиваются в очередь по сетевому вызову (RTT × N), поток пула занят всё это время. При пиках это отказ сервиса.
    Лишний `CreateScope` на каждый вызов делается только ради обхода зависимостей. Нужно сделать метод async, убрать lock и кэшировать курсы на короткое время (`IMemoryCache`).

13. **Services/RateService.cs:14** — `currency` из query подставляется в URL без валидации/кодирования.
    Последствия: `currency=../admin` ходит на произвольные пути сервиса курсов. `dto!.Rate` даёт NRE на пустом ответе. Нет таймаута и ретраев. Курс 0 даёт деление на ноль в конвертере. Нужен белый список ISO-кодов (3 буквы), `Uri.EscapeDataString` и проверка `rate > 0`.

14. **Controllers/OrderExportController.cs:22** — `{o.Total}` и `{o.CreatedAt:O}` в CSV с разделителем `;` форматируются по текущей культуре.
    Последствия: при ru-культуре сумма получается `12,50`, колонки разъезжаются или бухгалтерия получает неверные числа. Нужен `CultureInfo.InvariantCulture`. `Number` не экранируется: возможна CSV/formula-инъекция и сломанные строки.

15. **Controllers/CustomerReportsController.cs:40-50** и все эндпоинты — нет `[Authorize]`, в `Program.cs` нет `AddAuthentication`/`UseAuthorization`.
    Последствия: список e-mail 40 тыс. клиентов, сводки и выгрузка всех заказов доступны анонимно (утечка персональных данных).

## Minor

16. **Controllers/CustomerReportsController.cs:41-49** — `ToListAsync()` по сущностям `Customer` тянет `Photo` (blob) и `Notes` ради одного e-mail. Нужна проекция `.Select(c => c.Email)`.
    `pageSize` и `page` не ограничены и не проверяются: `pageSize=10000000` выгружает всё, а отрицательные значения дают ошибку OFFSET. `page * pageSize` может переполниться int.

17. **Controllers/CustomerReportsController.cs:16** — `FirstOrDefaultAsync` на `Customer` читает `Photo` и `Notes`, хотя нужны только `Id` и `Name`. Достаточно проекции.

18. **Controllers/CustomerReportsController.cs:36-37** — `CountAsync(...) > 0` вместо `AnyAsync`. На 3 млн строк лишний подсчёт вместо остановки на первой.

19. **Controllers/CustomerReportsController.cs:14,24** — `DateTime? since` приходит с `Kind=Unspecified`/Local. Как только фильтр уйдёт в SQL (после исправления п. 1), Npgsql бросит исключение для `timestamptz`. Нужно нормализовать в UTC.

20. **Services/CurrencyConverter.cs:6-18** — счётчик меняется под `lock` через `_conversions++`, а читается через `Interlocked.Read`. Смесь двух схем синхронизации; после снятия lock (п. 12) нужен `Interlocked.Increment`.

21. **Controllers/InvoiceController.cs:26, Services/CurrencyConverter.cs:19** — `Math.Round` по умолчанию использует банковское округление (ToEven). Для денег нужно явно `MidpointRounding.AwayFromZero` (или согласованное с бухгалтерией правило).

22. **Controllers/InvoiceController.cs:37** — `Task.Run` для CPU-коротких вычислений ничего не даёт, только лишнее переключение потоков. Контрольная сумма считается по телу без заголовка и передаётся только в HTTP-заголовке, а не внутри файла. Стоит зафиксировать контракт.

23. **Data/OrdersDbContext.cs** — нет `OnModelCreating`: нет индексов под `Orders.Status`, `Orders.CreatedAt` и `Customers.AcceptsMarketing`, не заданы точность `decimal` и длины строк.
    Последствия: на 3 млн заказов выгрузка по статусу и фильтр по дате идут полным сканом. Lazy-прокси включены глобально и провоцируют N+1; для API-проекций надёжнее явный `Include`/проекции.

24. **Program.cs:11-12** — у `HttpClient` нет явного таймаута (по умолчанию 100 с) и нет политик ретраев/circuit breaker. Зависший сервис курсов подвешивает запросы счетов и конвертации.

## Итого

- blocker: 7
- major: 8
- minor: 9

Всего: 24
