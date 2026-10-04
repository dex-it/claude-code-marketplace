# Ревью MR: отчёты по клиентам и счета

Контекст: прод, 40 тыс. клиентов, 3 млн заказов, EF Core 8 + Npgsql 8, lazy-loading proxies включены глобально.

## Blocker

1. **Controllers/OrderExportController.cs:15** - `FromSqlRaw($"... WHERE status = '{status}'")`: интерполированная строка уходит в `FromSqlRaw` как готовый SQL, параметра нет. Итог: SQL-инъекция из query-параметра (`status=' OR 1=1 --` выгружает всё, возможны `UNION` по чужим таблицам). Исправление: `FromSql($"... WHERE \"Status\" = {status}")` или обычный LINQ `Where(o => o.Status == status)`.

2. **Controllers/CustomerReportsController.cs:25-26** - `db.Orders.ToListAsync()` тянет все 3 млн заказов в память (с трекингом и прокси), затем `Count` фильтрует в памяти. Итог: каждый вызов сводки - полный скан таблицы, сотни МБ на запрос, OOM/GC-паузы и выпадение сервиса при параллельных вызовах. Считать в БД: `CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`.

3. **Controllers/CustomerReportsController.cs:28** - аргумент `LogDebug` - интерполированная строка с `JsonSerializer.Serialize(orders)`, вычисляется до проверки уровня, то есть всегда, в том числе в проде с Info. Сериализация lazy-proxy `Order` идёт в `Customer` -> `Orders` -> `Customer`...: лениво догружает связи (доп. запросы) и падает `JsonException` (object cycle) - эндпоинт отдаёт 500 на каждого клиента с заказами. Плюс PII (email клиента через навигацию) в логах. Использовать шаблон сообщения с плейсхолдерами и не сериализовать сущности; при необходимости - `IsEnabled(LogLevel.Debug)`.

4. **Services/CurrencyConverter.cs:15-17** (вызов из **Controllers/InvoiceController.cs:48**) - singleton держит `lock` вокруг HTTP-запроса к сервису курсов, который к тому же ждётся синхронно (`GetAwaiter().GetResult()`). Итог: все конвертации в приложении выстраиваются в очередь по одной, каждый ждущий поток блокирован; при медленном сервисе курсов (таймаут HttpClient по умолчанию 100 с) - голодание пула потоков и зависание всего API, не только этого эндпоинта. Лок нужен только для счётчика: `Interlocked.Increment`, метод сделать `async`, курс получать `await` вне лока (и кэшировать с TTL).

## Major

5. **Controllers/CustomerReportsController.cs:19-22** (+ **Program.cs:9**) - N+1: для каждого заказа `order.Lines` лениво догружается отдельным запросом (lazy-loading proxies). Клиент с 1000 заказов = 1001 запрос на сводку. Плюс тянутся все колонки заказов ради суммы. Агрегировать в БД: `db.OrderLines.Where(l => l.Order.CustomerId == customerId).SumAsync(l => l.Quantity * l.UnitPrice)`.

6. **Program.cs:9** - `UseLazyLoadingProxies()` включён глобально новым кодом. Любое обращение к навигации в цикле или при сериализации молча превращается в N+1 / доп. запросы (см. п.3, п.5); ошибка не видна на ревью и в тестах на малых данных. Предлагаю не включать, грузить явно (`Include`/проекция).

7. **Controllers/InvoiceController.cs:22** - `rates.GetRateAsync("EUR").Result` - sync-over-async в обработчике запроса: блокирует поток пула на время внешнего HTTP-вызова, под нагрузкой - thread pool starvation. `await`. Курс EUR тянется внешним вызовом на каждый счёт - кэшировать.

8. **Controllers/InvoiceController.cs:24-28,33** - `rows` объявлен как `IEnumerable<InvoiceRow>` поверх `IQueryable`: `Sum` (стр.28) и `Render` (стр.33, `foreach`) дважды выполняют запрос к БД, оба раза синхронно (sync I/O в async-действии). Между двумя выполнениями данные могут измениться - итог в PDF не сойдётся со строками. Материализовать один раз `ToListAsync()` и считать сумму по списку.

9. **Controllers/InvoiceController.cs:30-31** - `Directory.EnumerateFiles(attachmentsDir)` бросает `DirectoryNotFoundException`, если у заказа нет каталога вложений - а это обычный случай. Итог: 500 на счёт для любого заказа без вложений. Плюс `.ToList().Count > 0` перечисляет весь каталог ради проверки наличия. `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`.

10. **Services/Checksum.cs:14-18** (вызов **Controllers/InvoiceController.cs:37**) - P/Invoke в zlib на каждый байт: переход managed->native и маршалинг массива на каждый байт PDF, на порядки медленнее одного вызова `crc32(0, buf, len)`. `Task.Run` в обработчике запроса ничего не выигрывает, лишь занимает второй поток пула. Один вызов на весь буфер или `System.IO.Hashing.Crc32` без натива. Попутно: сигнатура `ulong` для `uLong` верна только на LP64 (Linux); на Windows `uLong` 32-битный.

11. **Controllers/OrderExportController.cs:15** - помимо инъекции: сырой SQL `SELECT * FROM orders WHERE status = ...` не совпадает с конвенцией EF+Npgsql: таблица создаётся как `"Orders"` и колонка `"Status"` (идентификаторы в кавычках, регистр значим), а без кавычек Postgres ищет `orders`/`status`. Итог: `relation "orders" does not exist`, выгрузка не работает вовсе (если в проекте нет snake_case-конвенции - её в MR нет).

12. **Controllers/OrderExportController.cs:14-24** - выгрузка без предела и без потока: все заказы статуса (до 3 млн) материализуются в список, затем целиком в `StringBuilder`, затем копией в `byte[]` - три полных копии в памяти, LOH. Итог: OOM/длинные GC-паузы у всего процесса при выгрузке бухгалтерии. Писать CSV потоком в `Response.Body` через `AsAsyncEnumerable()` и проекцию нужных колонок, либо ограничить период/страницу.

13. **Controllers/CustomerReportsController.cs:41-49** - `pageSize` приходит от клиента без верхней границы (`pageSize=1000000` - вся таблица), а материализуется целая сущность `Customer` с `Photo` (`byte[]`) и `Notes` ради одного `Email`. Итог: страница по 500 клиентов тянет 500 фото из БД. Проекция `.Select(c => c.Email)` и `Math.Clamp(pageSize, 1, 1000)`; отрицательный `page` даёт отрицательный `Skip` -> исключение/500, валидировать.

14. **Controllers/*.cs (все эндпоинты)** - ни на одном контроллере нет `[Authorize]`, аутентификации в `Program.cs` нет. Итог: любой по сети получает список email-адресов рассылки (стр. 40 CustomerReports), счета чужих заказов перебором `orderId` (IDOR), выгрузку заказов для бухгалтерии. Утечка персональных данных.

15. **Services/PdfRenderer.cs:14-22** - на выходе не PDF: заголовок `%PDF-1.7` и следом plain text, без объектов, xref и trailer. Итог: клиент получает `application/pdf`, который не открывается ни одним просмотрщиком. Нужна PDF-библиотека.

## Minor

16. **Controllers/CustomerReportsController.cs:16** - клиент грузится целиком (с `Photo`, `Notes`) ради `Id` и `Name`; проекция.

17. **Controllers/CustomerReportsController.cs:30** (+ стр.8) - `(int)linesTotal`: денежная сумма обрезается до целого (копейки теряются), а при сумме > `int.MaxValue` явное приведение `decimal` -> `int` бросает `OverflowException`. Тип поля - `decimal`.

18. **Controllers/CustomerReportsController.cs:36-37** - `CountAsync(...) > 0` для проверки наличия: считает все заказы клиента вместо остановки на первом. `AnyAsync`.

19. **Controllers/InvoiceController.cs:35-36** - копия всего PDF в новый массив ради пропуска 8 байт заголовка. `pdf.AsSpan(PdfRenderer.HeaderSize)` (с API чексуммы на span).

20. **Services/RateService.cs:14-15** - `currency` из query без валидации подставляется в путь запроса (`rates/../...` - обращение к произвольному пути хоста курсов); `dto!` - при пустом ответе `NullReferenceException` вместо внятной ошибки; нулевой курс даёт `DivideByZeroException` в `CurrencyConverter.cs:19` и `InvoiceController.cs:26`. Валидировать код валюты (ISO 4217, whitelist) и ответ.

21. **Controllers/OrderExportController.cs:22** - CSV без экранирования (`;`/перевод строки в `Number` ломает строку) и с форматированием `decimal`/даты по текущей культуре: при `ru-RU` итоги будут с запятой, бухгалтерский импорт разъедется. `CultureInfo.InvariantCulture` и экранирование полей. То же для сумм в `PdfRenderer.cs:18-19`.

22. **Controllers/*.cs** - асинхронные действия не принимают `CancellationToken` и не передают его в EF/HTTP: оборванный клиент не отменяет тяжёлые запросы (выгрузка, сводка).
