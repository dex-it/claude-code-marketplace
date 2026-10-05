# REVIEW: Orders.Api, отчёты и счета

Масштаб: 40 тыс. клиентов, 3 млн заказов. Включены lazy-прокси EF Core.

## Blocker

1. **Controllers/OrderExportController.cs:15**: SQL-инъекция. `status` из query подставляется в `FromSqlRaw($"...")`. Интерполяция внутри `FromSqlRaw` не параметризует значение (параметры делает только `FromSql` / `FromSqlInterpolated`).
   - Последствия: `status=' OR 1=1 --` выгружает все заказы. `'; DROP TABLE ...` может уничтожить данные. Это утечка данных или потеря БД.
   - Исправление: `FromSql($"... {status}")` или LINQ `Where(o => o.Status == status)`.

2. **Controllers/CustomerReportsController.cs:25-26**: `db.Orders.ToListAsync()` без фильтра загружает все 3 млн заказов в память с трекингом, и только потом фильтрует через `Count` в памяти.
   - Последствия: каждый вызов summary занимает гигабайты и секунды, нагружает GC и БД. Несколько параллельных запросов дают OOM и падение процесса.
   - Исправление: `CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`.

3. **Controllers/CustomerReportsController.cs:19-22**: N+1 через lazy loading. Заказы клиента грузятся с трекингом, затем `order.Lines` в цикле делает по одному запросу на заказ.
   - Последствия: у клиента с тысячами заказов это тысячи round-trip в БД на один HTTP-запрос. Эндпоинт получается медленным и перегружает пул соединений.
   - Исправление: агрегат одним запросом: `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`.

4. **Services/Checksum.cs:13-18**: CRC считается вызовом P/Invoke на каждый байт, через `byte[1]`. На счёт в сотни КБ приходятся сотни тысяч native-вызовов с маршалингом, и это идёт на hot path. Есть и проблемы корректности:
   - `crc32` из zlib принимает `uLong` (на Windows это 32 бита, на Linux 64), так что сигнатура непереносима.
   - Библиотека `"libz"` может не резолвиться (`libz.so.1`, Windows, alpine). Результат: `DllNotFoundException` и 500 на каждом счёте.
   - Исправление: `System.IO.Hashing.Crc32.HashToUInt32(ReadOnlySpan<byte>)` одним вызовом.

5. **Services/CurrencyConverter.cs:15-17**: `lock` в singleton, внутри него синхронный `GetAwaiter().GetResult()` на HTTP-вызов. Все конвертации сериализуются в один поток, и каждая держит блокировку на время сетевого запроса. Заблокированные потоки пула съедают остальные.
   - Последствия: при росте нагрузки или медленном сервисе курсов возникает thread-pool starvation, и падает весь API, а не только `total-in`.
   - Исправление: сделать метод `async`, убрать `lock` (он ничего не защищает), счётчик вести через `Interlocked.Increment`, курсы кэшировать.

## Major

6. **Controllers/InvoiceController.cs:22**: `rates.GetRateAsync("EUR").Result`: sync-over-async в обработчике запроса. Это блокирует поток пула, а при сбое оборачивает исключение в `AggregateException`. Нужен `await`. Курс не кэшируется, поэтому внешний HTTP-вызов делается на каждый счёт.

7. **Controllers/InvoiceController.cs:24-33**: `rows` объявлена как `IEnumerable` над `IQueryable`, то есть это отложенный запрос.
   - Он выполняется дважды: в `rows.Sum` (строка 28, `AmountEur` считается в SQL) и в `PdfRenderer.Render` (`foreach`).
   - Между запросами строки могут измениться, и тогда итог и строки счёта разойдутся.
   - Нужно материализовать один раз: `await ...ToListAsync()`, затем `Sum` в памяти.
   - Деление на `eurRate == 0` даёт исключение. Это не проверяется.

8. **Controllers/InvoiceController.cs:30-31**: `Directory.EnumerateFiles(...)` бросает `DirectoryNotFoundException`, если у заказа нет каталога вложений. А это основной случай.
   - Последствия: 500 на счёте любого заказа без вложений.
   - Дополнительно: `ToList().Count > 0` перечисляет все файлы ради проверки наличия. Нужно `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`.
   - `config["Attachments:Root"]!` без конфига даёт `ArgumentNullException`.

9. **Controllers/InvoiceController.cs:35-37**: копия всего тела PDF (`new byte[]` + `Array.Copy`) ради контрольной суммы. Хватает среза: `pdf.AsSpan(PdfRenderer.HeaderSize)` или `ReadOnlySpan`, и `Checksum.Compute` должен принимать `ReadOnlySpan<byte>`. Лишнее выделение на каждый запрос, для больших счетов это LOH. `Task.Run` вокруг CPU-вычисления на 1 запрос бессмыслен: он только добавляет переключение потоков.

10. **Controllers/OrderExportController.cs:14-24**: выгрузка заказов без лимита и без стриминга. Статус с большой долей даёт сотни тысяч или миллионы строк: `ToListAsync`, затем `StringBuilder`, затем `string`, затем `byte[]`. Это 3-4 копии в памяти, OOM под нагрузкой. Нужны `AsAsyncEnumerable` и запись в `Response.Body` (или пагинация), а также выборка только нужных колонок (`SELECT *`).

11. **Controllers/CustomerReportsController.cs:43-49** (MailingList): загружаются целые сущности `Customer` с трекингом. Среди полей `Photo` (byte[]) и `Notes`, а нужен только `Email`. 500 записей по картинкам дают десятки МБ на страницу.
    - Нужно `.Select(c => c.Email)` (и `AsNoTracking`).
    - `pageSize` не ограничен: `pageSize=10000000` отдаёт всю таблицу.
    - `page * pageSize` может переполнить `int`, а отрицательные значения дают исключение.

12. **Controllers/CustomerReportsController.cs:28**: `LogDebug($"...{JsonSerializer.Serialize(orders)}")`. Интерполяция и сериализация выполняются всегда, даже при выключенном Debug. Сериализуются все заказы клиента вместе с lazy-прокси.
    - Последствия: сериализация `Order.Customer` и `Customer.Orders` через прокси либо падает с циклической ссылкой (`JsonException`, 500), либо подгружает весь граф через lazy loading, это ещё N+1.
    - В лог попадают персональные данные.
    - Нужно убрать, либо `LogDebug("...{CustomerId}", id)`.

13. **Controllers/InvoiceController.cs:44-48 и Services/RateService.cs:14**: `currency` не валидируется. Значение подставляется в путь запроса `rates/{currency}` (path-инъекция: `../`, `?`). `null` приводит к запросу `rates/`. Нет обработки сбоя HTTP и `dto == null` (`dto!`). Нужен белый список кодов (`^[A-Z]{3}$`), `ProblemDetails` при ошибках, `Uri.EscapeDataString`, таймаут и кэш на `HttpClient`. `rate == 0` приводит к `DivideByZeroException`.

## Minor

14. **Controllers/CustomerReportsController.cs:36-37**: `CountAsync(...) > 0` вместо `AnyAsync`. На 3 млн заказов это лишний подсчёт всех заказов клиента вместо остановки на первом найденном.

15. **Controllers/CustomerReportsController.cs:30**: `(int)linesTotal` усекает decimal (теряются копейки, возможно переполнение), а имя поля `LinesTotal` подразумевает деньги. Нужен `decimal` в `CustomerSummary`.

16. **Controllers/CustomerReportsController.cs:16**: `FirstOrDefaultAsync` по `Customer` грузит `Photo` и `Notes`, хотя нужны только `Id` и `Name`. Не хватает проекции.

17. **Controllers/OrderExportController.cs:21-22**: CSV собирается вручную. `Number` и другие поля не экранируются (`;`, перевод строки, формула `=...` вызывает CSV-инъекцию в Excel). `o.Total` форматируется текущей культурой (запятая или точка), у бухгалтерии разойдутся форматы. Нужен `CultureInfo.InvariantCulture` и экранирование.

18. **Services/CurrencyConverter.cs:12-13, 18**: scope создаётся на каждую конвертацию только ради `IRateService`. Проще вынести `IRateService` как зависимость контроллера, а сам конвертер сделать scoped. `_conversions++` под `lock`, а чтение через `Interlocked.Read`. Это смешение двух механизмов синхронизации, нужно `Interlocked.Increment`.

19. **Services/PdfRenderer.cs:14-21**: «PDF» это строка `%PDF-1.7` плюс обычный текст, а не валидный PDF. Файл не откроется в просмотрщиках. Форматирование decimal зависит от культуры сервера. Нужна настоящая библиотека (QuestPDF и т. п.).

20. **Orders.Api.csproj / Data/OrdersDbContext.cs / Program.cs**: нет индексов и конфигурации модели (`Orders.CustomerId`, `Orders.Status`, `OrderLines.OrderId`, `Customers.AcceptsMarketing`) на таблицах из 3 млн строк, а все запросы фильтруют по этим колонкам. Нет `[Authorize]` на эндпоинтах, которые отдают персональные данные и e-mail (mailing-list, export). Lazy loading включён глобально и маскирует N+1, стоит рассмотреть его отключение.

## Итого
- blocker: 5
- major: 8
- minor: 7
