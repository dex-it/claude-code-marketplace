# Ревью MR: отчёты по клиентам и счета (Orders.Api)

Объём данных: 40 тыс. клиентов, 3 млн заказов. Код не правился. Сборку и тесты не запускал, выводы сделаны по чтению кода.

## Blocker

1. **Controllers/CustomerReportsController.cs:25-26** — `db.Orders.ToListAsync()` без фильтра загружает в память все 3 млн заказов (с lazy-proxy, с трекингом). Фильтр по клиенту и дате применяется уже в памяти. Результат: на каждый вызов `summary` приложение получает OOM или GC-паузы на гигабайтах, БД перегружена, сервис падает при нескольких параллельных запросах. Нужно `db.Orders.CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`.

2. **Controllers/OrderExportController.cs:15** — SQL-инъекция. `FromSqlRaw($"... '{status}'")` подставляет строку из query в SQL (интерполяция происходит до вызова, параметризации нет). Результат: `status=' OR 1=1 --` выгружает всё. Через `;` возможны произвольные команды, в зависимости от прав БД-пользователя. Нужно `FromSql($"...{status}")` или `Where(o => o.Status == status)`.

3. **Controllers/InvoiceController.cs:30-31** — `Directory.EnumerateFiles` бросает `DirectoryNotFoundException`, если у заказа нет каталога вложений. У большинства заказов его не будет, поэтому счёт отдаёт 500. Дополнительно `config["Attachments:Root"]!` падает с NRE, если ключ не задан. Нужно проверять `Directory.Exists`, использовать `.Any()` вместо `ToList().Count > 0` и проверять конфиг при старте.

4. **Services/CurrencyConverter.cs:15-20** — синхронный HTTP-вызов к сервису курсов (`GetAwaiter().GetResult()`) выполняется внутри `lock` в singleton. Все конвертации по всему приложению идут строго по очереди, каждая блокирует поток пула на время внешнего запроса. Результат: пропускная способность `total-in` равна 1/latency внешнего сервиса. При медленных курсах пул потоков исчерпывается и API встаёт целиком, включая другие эндпоинты. Lock здесь не нужен, он ничего не защищает. Нужен `async` метод, кэш курсов с TTL и таймаут.

5. **Controllers/CustomerReportsController.cs:28** — `JsonSerializer.Serialize(orders)` по lazy-proxy сущностям. Граф `Order -> Customer -> Orders -> ...` циклический, `System.Text.Json` бросает `JsonException` по глубине. Если цикла нет, сериализация триггерит lazy load всех связей (`Lines`, `Customer`, `Customer.Orders`) и это тоже запросы в БД. Интерполированная строка вычисляется всегда, даже когда уровень Debug выключен. Результат: `summary` падает с 500 у любого клиента с заказами или делает лавину запросов. В лог при этом попадают персональные данные. Нужно удалить строку или логировать только `customerId` и количество через структурный шаблон.

## Major

6. **Controllers/CustomerReportsController.cs:19-22** — N+1. `Lines` — ленивая навигация, поэтому по одному запросу на каждый заказ клиента, а заказы ещё и трекаются. Для клиента с сотнями заказов это сотни запросов. Нужно `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`.

7. **Controllers/CustomerReportsController.cs:30** — `(int)linesTotal` обрезает копейки и переполняется на больших суммах (в unchecked-контексте значение будет неверным). Поле `LinesTotal` в `CustomerSummary` должно быть `decimal`. Сейчас отчёт показывает неверные суммы.

8. **Controllers/InvoiceController.cs:22** — `rates.GetRateAsync("EUR").Result` — sync-over-async в async-методе. Это блокирует поток пула, исключения приходят обёрнутыми в `AggregateException`. Нужен `await`. Курс при этом не кэшируется, внешний вызов идёт на каждый счёт. Деления на `eurRate` без проверки на 0 тоже нет (стр. 26).

9. **Controllers/InvoiceController.cs:24-33** — `rows` это `IQueryable`, приведённый к `IEnumerable`, и он перечисляется дважды: `Sum` (стр. 28) и внутри `Render` (PdfRenderer.cs:17). Это два синхронных запроса в БД. Если данные изменятся между ними, строки в PDF и итог разойдутся. Нужно материализовать один раз: `await ... ToListAsync()`. Итог в EUR считается как сумма округлённых строк и не сверяется с `order.Total`.

10. **Services/Checksum.cs:7-18** — P/Invoke в `libz` на каждый байт: для PDF в сотни КБ это сотни тысяч нативных вызовов. Вторая проблема — сигнатура: в zlib `uLong` это `unsigned long`, 64 бита на Linux/macOS и 32 бита на Windows, а `ulong` в C# всегда 64 бита. На Windows ABI не совпадает. Кроме того, имя `"libz"` без версии часто не резолвится в runtime-образах (там есть только `libz.so.1`), будет `DllNotFoundException`. Нужно `System.IO.Hashing.Crc32` (или `System.IO.Hashing.Crc32.HashToUInt32`) на весь буфер. Плюс `Task.Run` для этого в InvoiceController.cs:37 не нужен.

11. **Services/PdfRenderer.cs:14-21** — это не PDF: после заголовка `%PDF-1.7` без перевода строки идёт обычный текст, нет ни объектов, ни xref, ни trailer. Любой просмотрщик сообщит, что файл повреждён. Контрольная сумма считается по `body` без заголовка (InvoiceController.cs:35-37), то есть заголовок не защищён, и клиент, проверяющий сумму всего файла, получит несовпадение. Нужна настоящая библиотека рендеринга PDF и чёткое определение, что именно покрывает checksum.

12. **Controllers/OrderExportController.cs:14-24** — нет ограничений на выгрузку. Все заказы статуса (до миллионов) читаются в `List`, затем собираются в `StringBuilder`, затем копируются в `byte[]` — в памяти получается три копии. На LOH это приведёт к OOM. Нужен стриминг (`AsAsyncEnumerable`, запись в `Response.Body`), пагинация или фоновое задание. Индекса по `status` в модели тоже нет.

13. **Controllers/OrderExportController.cs:15** — неквотированные имена в SQL. По умолчанию EF/Npgsql создаёт таблицу `"Orders"` и колонку `"Status"` с регистром. Запрос `FROM orders WHERE status` для Postgres ищет `orders`/`status` в нижнем регистре. Если миграции не переопределяют имена, запрос падает с `relation "orders" does not exist`. Проверить маппинг или использовать LINQ.

14. **Controllers/OrderExportController.cs:20-22** — CSV собирается руками: форматирование `decimal` и `DateTime` зависит от текущей культуры (при запятой в качестве десятичного разделителя и разделителе `;` бухгалтерия получит «сломанные» колонки). Значения не экранируются: `Number` с `;`, переводом строки или `=...` даст сдвиг колонок или CSV-инъекцию в Excel. Нужны `CultureInfo.InvariantCulture` и CSV-писатель с экранированием.

15. **Controllers/CustomerReportsController.cs:40-49** — `MailingList` загружает полные сущности `Customer`, включая `Photo` (byte[]) и `Notes`, ради одного `Email`. Нужен `.Select(c => c.Email)` перед `ToListAsync`. Параметры не валидируются: `page < 0` или `pageSize <= 0` дают ошибку Npgsql (`OFFSET must not be negative`), огромный `pageSize` выгружает всю базу, `page * pageSize` может переполнить int. Эндпоинт отдаёт персональные данные без какой-либо авторизации (на всех контроллерах нет `[Authorize]`, в Program.cs нет `UseAuthentication/UseAuthorization`).

16. **Controllers/InvoiceController.cs:44-48 и Services/RateService.cs:14** — `currency` из query вставляется в путь `rates/{currency}` без экранирования и валидации. Значение вроде `../admin` меняет путь запроса к внутреннему сервису. `null` или неизвестная валюта приводит к `HttpRequestException` или NRE (`dto!`) и 500. Нужен allow-list ISO-кодов и `Uri.EscapeDataString`, а `rate <= 0` стоит отклонять. Для API без таймаута и `CancellationToken` зависание внешнего сервиса держит запрос бесконечно.

## Minor

17. **Controllers/CustomerReportsController.cs:34-37** — `CountAsync(...) > 0` вместо `AnyAsync`. Лишний подсчёт по 3 млн строк (при отсутствии индекса по `CustomerId` это ещё и seq scan). В модели нет явного индекса на `Order.CustomerId`, `Order.Status`, `OrderLine.OrderId`, стоит добавить в `OnModelCreating`/миграцию.

18. **Controllers/CustomerReportsController.cs:24-26** — `since` приходит как `DateTime` с `Kind=Unspecified`. Как только фильтр перенесут в SQL (как предложено в п. 1), Npgsql 8 для `timestamptz` бросит исключение на Unspecified/Local. Нужно нормализовать в UTC.

19. **Services/CurrencyConverter.cs:5-8,18** — `_conversions++` под `lock`, а читается через `Interlocked.Read`. Схема смешанная, достаточно `Interlocked.Increment`. Scope создаётся на каждый вызов только ради получения typed-клиента (проще вынести в async-сервис).

20. **Все контроллеры** — методы не принимают `CancellationToken`. Прерванные клиентом запросы к 3-миллионной таблице продолжают выполняться.

21. **Data/OrdersDbContext.cs** — `Customer.Orders`, `Order.Customer`, `Order.Lines` объявлены `virtual` и работают через lazy-loading proxies. На отчётных эндпоинтах это провоцирует скрытые запросы (пп. 5-6). Для отчётов нужны явные проекции, а lazy loading лучше отключить.
