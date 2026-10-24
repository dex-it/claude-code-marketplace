# Ревью MR: отчёты по клиентам и счета (Orders.Api)

Масштаб: 40 тыс. клиентов, 3 млн заказов. Код не запускался, ревью статическое.
Итого: blocker 5, major 12, minor 8 (всего 25).

## Blocker

1. **Controllers/OrderExportController.cs:15** - SQL-инъекция. `FromSqlRaw($"... '{status}'")` получает уже интерполированную строку, параметризации нет. Итог: `status=' OR 1=1 --` отдаёт весь заказный CSV, `'; DROP TABLE ...` исполняется под учёткой приложения. Нужен `FromSqlInterpolated` / `FromSql($"...")` или LINQ `Where(o => o.Status == status)`.

2. **Controllers/CustomerReportsController.cs:25** - `db.Orders.ToListAsync()` грузит все 3 млн заказов (с lazy-прокси и трекингом) ради счётчика по одному клиенту, потом фильтр в памяти. Итог: OOM / минуты на запрос, один вызов кладёт процесс. Нужно `db.Orders.CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`.

3. **Controllers/CustomerReportsController.cs:28** - `LogDebug($"...{JsonSerializer.Serialize(orders)}")`: интерполяция и сериализация выполняются всегда, независимо от уровня лога. Сериализуются сущности с навигациями: `Order.Customer` <-> `Customer.Orders` дают цикл (ReferenceHandler не задан), плюс лениво подтягиваются Lines всех заказов. Итог: `JsonException` (превышена глубина) -> 500 на каждом клиенте с заказами, а если бы не цикл - полная выгрузка данных клиента в лог (ПДн). Убрать, либо шаблон `LogDebug("... {Count}", orders.Count)`.

4. **Controllers/InvoiceController.cs:30-31** - `Directory.EnumerateFiles(attachmentsDir)` бросает `DirectoryNotFoundException`, если каталога вложений заказа нет (для большинства заказов его не будет). Итог: 500 вместо счёта. Плюс `.ToList().Count > 0` перечисляет все файлы ради флага. Нужно `Directory.Exists(...) && Directory.EnumerateFiles(...).Any()`.

5. **Services/PdfRenderer.cs:14-21** - "PDF" это строка `%PDF-1.7` с приклеенным без перевода строки текстом: нет объектов, xref, trailer. Итог: файл с `application/pdf` не открывается ни в одном просмотрщике, бухгалтерия получает нерабочие счета. Нужна реальная PDF-библиотека.

## Major

6. **Data/OrdersDbContext.cs / Controllers/OrderExportController.cs:15** - в сыром SQL имена `orders`, `status` в нижнем регистре, а модель без `OnModelCreating`/snake-case конвенции: EF и Npgsql создадут `"Orders"`, `"Status"` в кавычках. Итог (если схема от миграций по умолчанию): `relation "orders" does not exist`, экспорт не работает. Проверить по миграции; лучше LINQ вместо raw SQL.

7. **Program.cs (весь файл), все контроллеры** - нет аутентификации/авторизации (`AddAuthentication`, `UseAuthorization`, `[Authorize]`). Итог: любой анонимный клиент читает почты рассылки, сводки по любому клиенту (IDOR по `customerId`), счета и выгрузку всех заказов бухгалтерии. Если защита в шлюзе - явно оговорить в MR.

8. **Controllers/InvoiceController.cs:22** - `rates.GetRateAsync("EUR").Result` в async-действии: блокировка потока пула, под нагрузкой starvation. Курс не кэшируется, внешний вызов на каждый счёт, без таймаута/CancellationToken. Нужно `await`, кэш курса с TTL.

9. **Controllers/InvoiceController.cs:24-33** - `rows` это неисполненный `IQueryable`, приведённый к `IEnumerable`: запрос выполняется дважды (`Sum` в строке 28 и внутри `Render`). Итог: лишняя нагрузка, и итог `totalEur` может не совпасть со строками, если строки меняются между запросами. Материализовать один раз (`ToListAsync`), суммировать из списка.

10. **Controllers/InvoiceController.cs:35-39** - контрольная сумма считается по файлу без первых 8 байт, а заголовок `X-Invoice-Checksum` ничего об этом не говорит. Итог: клиент, считающий CRC скачанного PDF целиком, всегда получает несовпадение; проверка целостности бесполезна. Считать по всему `pdf` либо документировать контракт.

11. **Services/Checksum.cs:7-19** - P/Invoke `libz` по одному байту: вызов нативной границы на каждый байт (миллионы вызовов на PDF), каждый раз маршалинг массива. `libz` без версии на Linux часто не резолвится (есть только `libz.so.1`) -> `DllNotFoundException`; на Windows библиотеки нет вовсе; `uLong` 32-битный на Windows и 64-битный на Linux, сигнатура с `ulong` неверна там. Итог: падение в проде либо неверная сумма. Использовать `System.IO.Hashing.Crc32.Hash(span)`.

12. **Services/CurrencyConverter.cs:15-20** - синхронный HTTP-вызов (`GetAwaiter().GetResult()`) внутри `lock` на singleton. Итог: все конверсии процесса идут строго по одной, пропускная способность = 1/latency внешнего сервиса, потоки пула блокируются в ожидании lock; при зависании курс-сервиса (таймаут HttpClient по умолчанию 100 с) встаёт весь `total-in`. Сделать асинхронным без lock (счётчик через `Interlocked`), кэшировать курс, задать таймаут.

13. **Controllers/CustomerReportsController.cs:19-22** - `order.Lines` лениво грузится по одному заказу (N+1) синхронным I/O внутри async-метода; у клиента с сотнями заказов - сотни запросов. Заменить на один запрос суммы: `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`.

14. **Controllers/CustomerReportsController.cs:8,30** - сумма в деньгах `decimal` приводится `(int)linesTotal`: дробная часть отбрасывается, на больших суммах переполнение (unchecked даёт мусор); поле названо `LinesTotal`, но это не число строк, а сумма. Итог: неверные цифры в отчёте. Тип `decimal`, имя `LinesAmount`.

15. **Controllers/CustomerReportsController.cs:43-49** - рассылка грузит целые сущности `Customer`, включая `Photo` (bytea) и `Notes`, с трекингом, ради одного `Email`. Итог: десятки МБ на страницу, лишнее давление на память. `.Select(c => c.Email)` до `ToListAsync`.

16. **Controllers/OrderExportController.cs:14-24** - выгрузка без ограничения и без стриминга: вся выборка (при частом статусе - миллионы заказов) в `List<Order>`, затем в `StringBuilder`, затем в `byte[]`. Итог: OOM / многогигабайтные пики памяти, таймаут. Стримить (`AsAsyncEnumerable` + запись в `Response.Body`), `Select` только нужных полей, индекс по `Status`.

17. **Services/CurrencyConverter.cs:19, Controllers/InvoiceController.cs:26** - `Math.Round` по умолчанию банковское округление (ToEven), для денег нужен `MidpointRounding.AwayFromZero`; `rate == 0` даёт `DivideByZeroException`; `currency` без валидации подставляется в путь `rates/{currency}` (path-инъекция в запрос к курс-сервису), неизвестная валюта даёт необработанный `HttpRequestException` (500). Итог: расхождения копеек в счетах и 500 на пользовательском вводе. Белый список валют, `Uri.EscapeDataString`, проверка курса.

## Minor

18. **Controllers/CustomerReportsController.cs:36** - `CountAsync(...) > 0` вместо `AnyAsync`. Лишний подсчёт по всем заказам клиента. Для несуществующего клиента ответ `false`, а не 404 - решить контрактом.

19. **Controllers/CustomerReportsController.cs:16** - клиент грузится целиком (`Photo`, `Notes`) ради `Id`/`Name`; взять проекцию.

20. **Controllers/InvoiceController.cs:37** - `Task.Run` для CPU-работы в запросе ASP.NET: лишний переход потоков без выигрыша (и после п.11 вообще не нужен).

21. **Services/CurrencyConverter.cs:6-8** - счётчик `_conversions` инкрементируется под `lock`, читается через `Interlocked.Read`: смешанная синхронизация, свойство `Conversions` нигде не используется. Либо `Interlocked.Increment` и использовать, либо удалить.

22. **Controllers/OrderExportController.cs:22** - значения CSV пишутся без экранирования: `Number` с `;`/переводом строки ломает строку, значение, начинающееся с `=`/`+`/`@`, - CSV-инъекция в Excel у бухгалтерии; `Total` форматируется по культуре сервера (запятая/точка), при `;`-разделителе возможна путаница. `CultureInfo.InvariantCulture` и экранирование.

23. **Controllers/CustomerReportsController.cs:41-46** - `pageSize` без верхней границы, отрицательные `page`/`pageSize` дают исключение EF/Npgsql (500), `page * pageSize` может переполнить int. Ограничить и валидировать.

24. **Program.cs:9,12** - `UseLazyLoadingProxies()` на всё приложение скрывает синхронный N+1 (см. п.13) в любом коде; для API с такими объёмами лучше явный `Include`/проекции без прокси. `Configuration["Rates:BaseUrl"]!` при отсутствии настройки падает на старте с непонятным `ArgumentNullException`; пакеты `Proxies` 8.0.8 и `Npgsql.EFCore` 8.0.4 разнесены по версиям.

25. **Все контроллеры** - ни одно действие не принимает `CancellationToken`: отмена запроса клиентом не прерывает тяжёлые запросы и HTTP-вызовы курса.
