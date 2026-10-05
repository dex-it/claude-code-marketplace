# Ревью MR: отчёты по клиентам и счета (Orders.Api)

Масштаб для оценок: 40 тыс. клиентов, 3 млн заказов (в среднем около 75 заказов на клиента). Код не правился.

## Blocker

1. **Controllers/OrderExportController.cs:15** - `FromSqlRaw($"... status = '{status}'")`: интерполяция в `FromSqlRaw` не параметризует значение. Это SQL-инъекция из query-параметра (`status=' OR 1=1 --`, стекинг запросов, чтение чужих таблиц). Кончится утечкой или порчей данных бухгалтерии. Нужно `FromSql($"...{status}")` или `FromSqlInterpolated`, либо LINQ `Where(o => o.Status == status)`.

2. **Controllers/CustomerReportsController.cs:25-26**: `db.Orders.ToListAsync()` без фильтра грузит все 3 млн заказов в память с change tracking и lazy-прокси, а потом считает `Count` в памяти. Один запрос сводки убивает процесс по памяти (OOM) и грузит БД. Нужно `db.Orders.CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`. Заказы клиента уже загружены строкой выше, достаточно и их фильтрации.

3. **Controllers/CustomerReportsController.cs:28**: `logger.LogDebug($"...{JsonSerializer.Serialize(orders)}")`. Интерполяция вычисляется всегда, независимо от уровня лога, поэтому сериализация идёт в проде на каждый вызов. С lazy-прокси она обходит `Order.Customer -> Customer.Orders -> Order ...`: это цикл, поднимающий `JsonException` (MaxDepth 64), плюс лавина lazy-загрузок `Customer`/`Lines`. Любая сводка по клиенту с хотя бы одним заказом падает с 500. Даже без цикла в лог утекают персональные данные. Нужно убрать сериализацию, оставить шаблон `LogDebug("Summary for {CustomerId}", customerId)`.

## Major

4. **Controllers/CustomerReportsController.cs:19-22**: N+1 через lazy loading. `order.Lines` в цикле даёт по синхронному запросу на каждый заказ (около 75 на клиента, у крупных клиентов тысячи), блокируя поток внутри async-метода. Нужна агрегация на сервере: `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`. Загружать заказы целиком не нужно.

5. **Controllers/CustomerReportsController.cs:30**: `(int)linesTotal` усекает денежную сумму (`decimal`) до целого и переполняется на больших значениях. Поле `LinesTotal` в `CustomerSummary` объявлено `int` для денег, суммы в отчёте будут неверными. Нужно `decimal`.

6. **Controllers/CustomerReportsController.cs:43-49**: список рассылки тянет сущности `Customer` целиком, включая `Photo` (byte[]) и `Notes`, ради одного `Email`, и ещё и как tracked-прокси. При 40 тыс. клиентов и странице в 500 это сотни МБ лишнего трафика. Нужно `.Select(c => c.Email)` и `AsNoTracking`. `pageSize` не ограничен сверху: `?pageSize=100000000` вытянет всю таблицу. Нужен верхний предел.

7. **Controllers/InvoiceController.cs:22**: `rates.GetRateAsync("EUR").Result` в async-экшене. Это sync-over-async: блокировка потока пула на каждый запрос, под нагрузкой thread pool starvation. Плюс внешний HTTP-вызов за курсом на каждый запрос без кэша и таймаута. Нужен `await`, кэш курса с TTL (`IMemoryCache`), `CancellationToken`.

8. **Controllers/InvoiceController.cs:24-28, 33**: `rows` объявлен как `IEnumerable<InvoiceRow>`, но это отложенный `IQueryable`. Он выполняется синхронно дважды: в `rows.Sum` (стр. 28) и при перечислении внутри `Render` (стр. 33). Это два запроса в БД и блокирующий I/O. Между ними строки могут измениться, и итог в PDF не совпадёт со строками. Нужно один раз `await ...ToListAsync()`, суммировать по списку.

9. **Controllers/InvoiceController.cs:30-31**: `Directory.EnumerateFiles(attachmentsDir)` бросает `DirectoryNotFoundException`, если у заказа нет папки вложений (обычный случай). Счёт для заказа без вложений отдаёт 500. Нужна проверка `Directory.Exists`. Кроме того, `.ToList().Count > 0` читает весь каталог ради булева значения, нужно `.Any()`.

10. **Services/CurrencyConverter.cs:15-20**: внешний HTTP-вызов (`GetAwaiter().GetResult()`) выполняется под глобальным `lock` в singleton. Все конвертации по всему сервису сериализуются в одну очередь (пропускная способность = 1 / задержку сервиса курсов), потоки пула блокируются, при задержке сервиса курсов возможен старвейшн и отказ всего API. `lock` ничего не защищает: `_conversions` читается через `Interlocked`, пишется под `lock`, и сам курс общих данных не меняет. Нужно async-метод без `lock`, `Interlocked.Increment`, кэш курса. Scope на каждый вызов ради `IRateService`, у которого нет scoped-зависимостей, не нужен.

11. **Controllers/OrderExportController.cs:14-22**: выгрузка по статусу собирает все подходящие заказы (до миллионов) в `List`, затем в `StringBuilder`, затем в `byte[]`. Это три копии в памяти, нет стриминга и лимита. Нужен постраничный/стриминговый вывод (`AsAsyncEnumerable` -> поток в `Response.Body`). Кроме того, сырой SQL использует неквотированные `orders`/`status`: при дефолтном именовании EF (таблица `"Orders"`, колонка `"Status"`) в Npgsql запрос упадёт с «relation does not exist». Это проверить по схеме БД (миграций в MR нет), при совпадении - 500 на каждый вызов.

12. **Во всём каталоге (Controllers/*.cs)**: нет `[Authorize]`, аутентификация в `Program.cs` не подключена. Список e-mail клиентов (стр. 40), сводка по любому `customerId`, счета и выгрузка всех заказов открыты анонимно (IDOR и утечка ПДн). Нужна авторизация и проверка владения клиентом.

## Minor

13. **Controllers/CustomerReportsController.cs:36-37**: `CountAsync(...)` с последующим `> 0` вместо `AnyAsync`. Лишний подсчёт по 3 млн строк вместо остановки на первой.

14. **Controllers/InvoiceController.cs:35-36**: `new byte[...]` и `Array.Copy` создают копию всего PDF ради тела без заголовка. Нужен срез: `pdf.AsSpan(PdfRenderer.HeaderSize)` или `ArraySegment`, `Checksum.Compute(ReadOnlySpan<byte>)`.

15. **Services/Checksum.cs:13-18**: P/Invoke `crc32` вызывается по одному байту с маршалингом массива на каждый вызов (десятки-сотни тысяч нативных переходов на PDF). Нужен один вызов на весь буфер или `System.IO.Hashing.Crc32`. `Task.Run` на стр. 37 InvoiceController лишний (уход в пул ради коротких вычислений).

16. **Services/Checksum.cs:7-8**: `[DllImport("libz")]` с `ulong` для `uLong`/`crc` совпадает по ширине только на Linux x64 (на Windows `unsigned long` 32 бита, несовпадение ABI). Имя `libz` в контейнере без `libz.so` (только `libz.so.1`) даёт `DllNotFoundException` на первом счёте. Это ломает все счета. Проверить в целевом образе.

17. **Services/PdfRenderer.cs:14-21**: результат - не PDF: сигнатура `%PDF-1.7` без перевода строки, дальше обычный текст без xref и объектов. Просмотрщики откроют с ошибкой, бухгалтерия получит битый файл с «контрольной суммой». Нужна настоящая PDF-библиотека.

18. **Services/PdfRenderer.cs:18-19, Controllers/OrderExportController.cs:22**: форматирование `decimal` и дат по текущей культуре сервера (запятая или точка в сумме, `;`-разделитель CSV). В выгрузке с `;`-разделителем десятичная запятая испортит колонки, нужны `CultureInfo.InvariantCulture` и экранирование полей (`Number` с `;`, формулы в Excel).

19. **Services/CurrencyConverter.cs:19, Services/RateService.cs:14**: курс 0 или недоступный сервис (404, таймаут) даёт `DivideByZeroException` / `HttpRequestException` - 500 без внятного ответа. `currency` из query подставляется в URL пути `rates/{currency}` без валидации и экранирования (`../...` меняет адресуемый ресурс на сервисе курсов). Нужен белый список валют и `Uri.EscapeDataString`.

20. **Все async-методы**: нет `CancellationToken` (отмена запроса клиентом не отменяет тяжёлые запросы к БД и HTTP).
