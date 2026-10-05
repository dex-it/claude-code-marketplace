# Ревью MR: отчёты по клиентам и счета

Находок: 22 (blocker: 4, major: 12, minor: 6). Мержить нельзя до исправления блокеров.

## Blocker

1. **Controllers/OrderExportController.cs:15**. `FromSqlRaw($"... '{status}'")`: интерполяция в `FromSqlRaw` не параметризуется, `status` идёт в SQL как есть. Итог: SQL-инъекция из query string, чтение и изменение любых данных БД. Исправление: `FromSqlInterpolated`/`FromSql` либо `db.Orders.Where(o => o.Status == status)`.

2. **Controllers/CustomerReportsController.cs:25-26**. `db.Orders.ToListAsync()` без фильтра грузит в память и трекает все 3 млн заказов ради подсчёта по одному клиенту. Итог: сотни МБ-ГБ на запрос, OOM и деградация БД при нескольких вызовах. Исправление: `await db.Orders.CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)`.

3. **Controllers/CustomerReportsController.cs:28**. Интерполированная строка в `LogDebug` собирается всегда, даже при выключенном Debug, и внутри `JsonSerializer.Serialize(orders)` по lazy-proxy сущностям. Сериализация обходит `Order.Customer -> Customer.Orders -> ...`, дёргает ленивую загрузку по всему графу и упирается в цикл (`JsonException` на глубине 64). Итог: эндпоинт отдаёт 500 для любого клиента с заказами, до этого успевает выгрузить граф из БД; в лог попадают персональные данные. Исправление: убрать строку или логировать `customerId` и `orders.Count` шаблоном `LogDebug("... {Id} {Count}", ...)`.

4. **Controllers/InvoiceController.cs:30-31**. `Directory.EnumerateFiles` бросает `DirectoryNotFoundException`, если каталога заказа нет, а он есть только у заказов с вложениями. Также `config["Attachments:Root"]!` при отсутствии ключа даст `ArgumentNullException`. Итог: счёт не выдаётся для большинства заказов (500). Исправление: `Directory.Exists(dir) && Directory.EnumerateFiles(dir).Any()`, ключ проверять на старте.

## Major

5. **CustomerReportsController.cs:19-22**. Заказы загружены с трекингом, `order.Lines` лениво (proxy) подгружается отдельным запросом на каждый заказ: N+1. Итог: у клиента со 100 заказами 101 запрос, сумма считается в памяти. Исправление: одним запросом `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)`.

6. **CustomerReportsController.cs:30**. `(int)linesTotal` отбрасывает копейки и переполняется на больших суммах; поле называется суммой, а хранит целое. Итог: неверные деньги в отчёте. Исправление: `decimal LinesTotal`.

7. **OrderExportController.cs:15**. Сырой SQL `FROM orders WHERE status` без `ToTable`/`HasColumnName` в модели: Npgsql/EF по умолчанию создаёт таблицу `"Orders"` и колонку `"Status"` (регистрозависимые), а неквотированные `orders`/`status` в PostgreSQL свернутся в нижний регистр. Итог: `relation "orders" does not exist`, выгрузка не работает (проверить по миграциям; в MR их нет). Уходит вместе с п.1 при переходе на LINQ.

8. **OrderExportController.cs:14-24**. Выгрузка без лимита и стриминга: весь результат в `List`, затем в `StringBuilder`, затем в `byte[]`, три копии. Для статуса с сотнями тысяч заказов это сотни МБ. Плюс: `{o.Total}` форматируется по текущей культуре (запятая вместо точки, ломает импорт), поля не экранируются (`;` и кавычки в `Number`, формулы `=...` в ячейках Excel). Исправление: стримить через `AsAsyncEnumerable` в `Response.Body`, `CultureInfo.InvariantCulture`, экранирование.

9. **InvoiceController.cs:22**. `rates.GetRateAsync("EUR").Result`: sync-over-async в запросе. Итог: блокировка потоков пула, при медленном сервисе курсов starvation всего API. Исправление: `await`.

10. **InvoiceController.cs:24-28, 33**. `rows` объявлен как `IEnumerable<InvoiceRow>`, поэтому `Sum` выполняется в памяти и запрос к БД идёт дважды (в `Sum` и в `Render`), между ними строки могут измениться и сумма разойдётся с телом счёта. Деление на `eurRate == 0` даёт `DivideByZeroException`. Исправление: `ToListAsync()` один раз, проверка курса.

11. **Services/PdfRenderer.cs:14-21**. Выдаётся не PDF: заголовок `%PDF-1.7` и далее простой текст, без объектов, xref и trailer. Итог: любой PDF-ридер откроет файл с ошибкой. Исправление: библиотека генерации PDF (QuestPDF и т. п.).

12. **Services/Checksum.cs:7-19**. (а) `DllImport("libz")` на Linux в slim-образе обычно не находится (`libz.so.1`): `DllNotFoundException`. (б) вызов на каждый байт с маршалингом массива: на счёте в сотни КБ это сотни тысяч P/Invoke. (в) `uLong` в zlib 32-битный на Windows и 64-битный на Linux, `ulong` в сигнатуре не переносим. Исправление: `System.IO.Hashing.Crc32.HashToUInt32(data)` (пакет System.IO.Hashing) или `SHA256`, если нужна контрольная сумма для проверки целостности.

13. **Services/CurrencyConverter.cs:15-20**. Singleton держит `lock` вокруг синхронного ожидания HTTP-вызова. Итог: все конвертации в процессе идут строго по одной, каждая блокирует поток; при задержке сервиса курсов 200 мс пропускная способность 5 запросов в секунду на весь сервис. Заодно scope на каждый вызов ради получения typed client. Исправление: сделать `Convert` асинхронным, убрать lock, внедрять `IRateService` напрямую (transient/scoped), счётчик через `Interlocked.Increment`.

14. **Services/RateService.cs:14, Program.cs:11**. Курс запрашивается по HTTP на каждый вызов, без кэша, таймаута, retry и обработки ошибок; `dto!` падает на `null`, неизвестная валюта даёт `HttpRequestException` (500). Курс 0 не отсекается. Итог: падение зависимого сервиса валит счета и `total-in`. Исправление: `IMemoryCache` с TTL, `Timeout`/resilience handler, 404 -> 400 пользователю.

15. **Все контроллеры**. Нет `[Authorize]`: список e-mail для рассылки, выгрузка заказов и счета любого заказа открыты любому, кто достучится до API; доступ к чужому `orderId` не проверяется (IDOR). Итог: утечка ПДн и финансовых данных. Исправление: авторизация и проверка принадлежности.

16. **CustomerReportsController.cs:41-49**. `pageSize` не ограничен (`?pageSize=1000000`), отрицательные `page`/`pageSize` дают исключение EF/Npgsql, `page * pageSize` может переполниться. Сущности грузятся целиком вместе с `Photo` и `Notes` и с трекингом ради одного поля. Исправление: ограничить `pageSize` (например 1..1000), `.Select(c => c.Email)` без трекинга.

## Minor

17. **CustomerReportsController.cs:36-37**. `CountAsync(...) > 0` вместо `AnyAsync(...)`: лишний полный подсчёт заказов.

18. **CustomerReportsController.cs:16**. Клиент грузится целиком с `Photo` и `Notes`, а нужны `Id` и `Name`. Исправление: проекция.

19. **CurrencyConverter.cs:19, InvoiceController.cs:26-28**. `Math.Round` по умолчанию банковский (ToEven), для денег нужен `MidpointRounding.AwayFromZero`. Сумма счёта считается как сумма округлённых строк, а `total-in` округляет итог целиком: суммы одного заказа могут расходиться на копейки.

20. **CurrencyConverter.cs:6-8,18**. Счётчик инкрементируется обычным `++` под lock, а читается через `Interlocked.Read`: смешанная схема синхронизации. После снятия lock (п.13) нужен `Interlocked.Increment`.

21. **InvoiceController.cs:37**. `Task.Run` для CPU-работы над небольшим массивом внутри запроса: лишнее переключение потоков без выигрыша; также лишняя копия `body` (`Array.Copy`), достаточно `ReadOnlySpan`.

22. **InvoiceController.cs:44-48**. `currency` не валидируется (`null`, пустая, неизвестная): ответ 500 вместо 400.
