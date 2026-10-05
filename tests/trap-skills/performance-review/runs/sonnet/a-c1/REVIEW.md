# Ревью MR: отчёты по клиентам и счета (Orders.Api)

Масштаб: 40 тыс. клиентов, 3 млн заказов (около 75 заказов на клиента). Код не правился.
Итого: blocker 4, major 10, minor 7.

## Blocker

1. **Controllers/OrderExportController.cs:15** - `FromSqlRaw($"... status = '{status}'")`. Интерполяция в `FromSqlRaw` не параметризует значение. `status` приходит из query string без валидации. Итог: SQL-инъекция, чтение и изменение всей БД через публичный эндпоинт. Нужен `FromSqlInterpolated` или LINQ `Where(o => o.Status == status)`.

2. **Controllers/CustomerReportsController.cs:25-26** - `db.Orders.ToListAsync()` без фильтра, затем `Count` в памяти. Загружаются все 3 млн заказов (с отслеживанием, плюс lazy-прокси) ради счётчика одного клиента. Итог: сотни МБ или ГБ на запрос, OOM или GC-паузы, один вызов кладёт процесс. Нужно `CountAsync(o => o.CustomerId == id && o.CreatedAt >= from)` в БД. С Npgsql 8 параметр `from` должен быть UTC (`DateTime.Kind`), иначе `since` из query (Kind=Unspecified) бросит исключение.

3. **Controllers/CustomerReportsController.cs:28** - `logger.LogDebug($"...{JsonSerializer.Serialize(orders)}")`. Интерполированная строка вычисляется всегда, независимо от уровня лога. Сериализуются lazy-прокси: `Order.Customer -> Customer.Orders -> ...` образует цикл, `JsonSerializer` бросает `JsonException` (превышена глубина), заодно триггерит lazy-загрузку `Lines`. Итог: `/summary` отдаёт 500 для любого клиента с заказами, а если не упадёт - лишние запросы и персональные данные в логах. Удалить или логировать только id и количество через шаблон `{CustomerId}`.

4. **Services/CurrencyConverter.cs:15-17** - внутри `lock (_sync)` синхронный вызов `GetRateAsync(...).GetAwaiter().GetResult()` к внешнему HTTP-сервису. Конвертер - singleton, так что все запросы `total-in` по всему приложению идут строго по одному и блокируют потоки пула. У HttpClient таймаут по умолчанию 100 с. Итог: при замедлении сервиса курсов очередь запросов копится, пул потоков голодает, лежит весь API. Нужны async, кэш курсов с TTL, таймаут и `CancellationToken`, без lock вокруг I/O.

## Major

5. **Controllers/CustomerReportsController.cs:19-22** - загружаются все заказы клиента как сущности, затем `order.Lines.Sum(...)` в цикле. При lazy-прокси это N+1: по одному запросу на заказ (около 75 в среднем, тысячи у крупных клиентов). Итог: десятки и сотни запросов на вызов, медленный отчёт, нагрузка на БД. Одним запросом агрегата: `OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`.

6. **Program.cs:15,18 (все контроллеры)** - нет аутентификации и авторизации: ни `AddAuthentication`/`UseAuthorization`, ни `[Authorize]`. Итог: любой аноним скачивает выгрузку всех заказов, список рассылки (email клиентов) и счета любого заказа по перебору `orderId` (IDOR). Нужен authN/authZ, проверка принадлежности ресурса.

7. **Controllers/InvoiceController.cs:22** - `rates.GetRateAsync("EUR").Result` в async-экшене. Блокирует поток пула на сетевом вызове; под нагрузкой starvation. Нужно `await`. Курс стоит кэшировать, он запрашивается на каждый счёт.

8. **Controllers/InvoiceController.cs:30-31** - `Directory.EnumerateFiles(attachmentsDir)` бросает `DirectoryNotFoundException`, когда каталога нет, а у заказа без вложений его, скорее всего, нет. Итог: 500 на счёт большинства заказов. Плюс `.ToList().Count > 0` вместо `Any()`, а `config["Attachments:Root"]!` падает с `ArgumentNullException`, если ключ не задан. Нужны `Directory.Exists` и проверка конфигурации на старте.

9. **Controllers/InvoiceController.cs:24-33** - `rows` объявлен как `IEnumerable<InvoiceRow>` поверх отложенного запроса и перечисляется дважды: `Sum` (стр. 28) и `Render` (стр. 33). Два обращения к БД на один счёт, между ними строки могут измениться, и итог в PDF не совпадёт со строками. Нужно один раз материализовать (`await ...ToListAsync()`) и считать итог по списку.

10. **Controllers/CustomerReportsController.cs:43-49 (и стр. 16)** - рассылка грузит целые сущности `Customer`, включая `Photo` (byte[]) и `Notes`, ради одного `Email`. Нужен `.Select(c => c.Email)`, он же снимает tracking. `pageSize` не ограничен (`pageSize=10000000` отдаёт всю таблицу), `page*pageSize` может переполнить int, отрицательный `page` даёт ошибку Skip. Нужны потолок `pageSize` и валидация. В `Summary` (стр. 16) аналогично: достаточно `AnyAsync` или проекции `Name`, а не загрузки фото.

11. **Controllers/OrderExportController.cs:14-24** - выгрузка по статусу без пагинации и стриминга: все строки в `List`, затем в `StringBuilder`, затем в `byte[]`. На сотнях тысяч заказов трёхкратное копирование в памяти, OOM, таймаут запроса. Также в сыром SQL используется таблица `orders` в нижнем регистре. EF/Npgsql по умолчанию создаёт `"Orders"` в кавычках без snake_case-конвенции (в коде её нет), поэтому запрос упадёт с `relation "orders" does not exist`. Нужны LINQ (имя таблицы берёт EF) и потоковая запись (`AsAsyncEnumerable` в `Response.Body`).

12. **Services/Checksum.cs:7-17** - три дефекта P/Invoke. (а) Сигнатура zlib: `uLong crc32(uLong, const Bytef*, uInt)`. `uLong` - 32 бита на Windows (LLP64) и 64 на Linux, а `ulong` в объявлении всегда 64, поэтому на Windows неверная ABI-сигнатура. (б) `"libz"` на Linux в контейнерах разрешается в `libz.so`, который есть только в dev-пакете, обычно доступен `libz.so.1`, итог `DllNotFoundException` в рантайме. (в) Вызов нативной функции на каждый байт с аллокацией и копированием: для PDF размером в МБ это миллионы переходов managed/native. Нужен `System.IO.Hashing.Crc32` (managed, один вызов на буфер) без нативной зависимости.

13. **Services/PdfRenderer.cs:14-21** - выдаётся не PDF: сигнатура `%PDF-1.7`, затем текст без структуры (нет objects, xref, trailer). Сигнатура сразу склеена с первой строкой текста, файл не открывается ни одним просмотрщиком. Ответ при этом помечен `application/pdf`. Итог: бухгалтерия получает нечитаемые "счета". Нужна настоящая PDF-библиотека (QuestPDF и т.п.).

14. **Services/RateService.cs:14 и Controllers/InvoiceController.cs:44-48** - параметр `currency` из query подставляется в путь `rates/{currency}` без валидации и экранирования (`../`, `?`, `#` меняют целевой URL на хосте курсов). `GetFromJsonAsync` бросает `HttpRequestException` на 404 для неизвестной валюты, `dto!.Rate` даёт NRE на пустом теле, курс 0 даёт `DivideByZeroException` в `CurrencyConverter.cs:19`. Итог: любая невалидная валюта - 500. Нужны whitelist валют (ISO 4217), `Uri.EscapeDataString`, обработка ошибок с 400/502, проверка `rate > 0`.

## Minor

15. **Controllers/CustomerReportsController.cs:34-37** - `CountAsync(...) > 0` вместо `AnyAsync`; считает все заказы клиента ради булева.

16. **Controllers/CustomerReportsController.cs:30** - `(int)linesTotal` усечёт копейки, а при сумме больше `int.MaxValue` бросит `OverflowException`. Сумму денег стоит возвращать как `decimal` (в DTO поле `LinesTotal` типа int вводит в заблуждение).

17. **Services/CurrencyConverter.cs:19 и Controllers/InvoiceController.cs:26** - `Math.Round(decimal, 2)` по умолчанию банковское округление (`ToEven`). Для денег и счетов нужно `MidpointRounding.AwayFromZero` или явно согласованное правило. В счёте суммируются округлённые построчные суммы, итог может разойтись с округлением суммарной. Нужно зафиксировать правило.

18. **Controllers/InvoiceController.cs:35-37 и Services/PdfRenderer.cs:9** - контрольная сумма считается по телу без первых 8 байт (`HeaderSize`), то есть не покрывает файл, а клиент, считающий CRC по скачанному файлу, получит несовпадение. `HeaderSize = 8` связан с длиной литерала `"%PDF-1.7"` неявно, при смене версии разойдётся. `Task.Run` на CPU-bound задачу внутри запроса только добавляет переключение потоков. Нужно считать по всему `pdf` и вынести длину заголовка из единого источника.

19. **Controllers/OrderExportController.cs:22** - CSV для бухгалтерии без экранирования (`Number` с `;` или кавычкой ломает колонки, значение с `=`, `+`, `@` - CSV-инъекция формул в Excel). Числа и даты форматируются текущей культурой (`{o.Total}`), разделитель дробной части может зависеть от настроек хоста. Нужны `CultureInfo.InvariantCulture` и экранирование.

20. **Все async-методы контроллеров и RateService.GetRateAsync** - нет `CancellationToken`. Отменённый клиентом запрос продолжает тяжёлые запросы к БД и вызовы к сервису курсов.

21. **Services/CurrencyConverter.cs:5-8,20 и Program.cs:11-12** - счётчик `_conversions` инкрементируется под `lock`, а читается через `Interlocked.Read` (две разные схемы синхронизации, `Conversions` нигде не используется - мёртвый код). `Rates:BaseUrl` берётся с `!`: при отсутствии настройки приложение падает на старте с неочевидным `ArgumentNullException`. У типизированного клиента нет ретраев и таймаута.
