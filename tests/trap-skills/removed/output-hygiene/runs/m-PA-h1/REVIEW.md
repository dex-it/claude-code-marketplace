# Ревью MR: отчёты по клиентам и счета (Orders.Api)

Масштаб для оценки: 40 тыс. клиентов, 3 млн заказов, EF Core 8 + Npgsql, lazy proxies.

Итого: blocker 3, major 10, minor 8 (всего 21).

## Blocker

### 1. Controllers/OrderExportController.cs:15 — SQL-инъекция
`FromSqlRaw($"... status = '{status}'")` — интерполяция превращает параметр запроса в строку SQL до передачи в EF. Запрос вида `status=' OR 1=1 --` отдаёт все 3 млн заказов, а `'; DROP TABLE orders; --` или чтение других таблиц через UNION доступны любому, кто дойдёт до эндпоинта (см. п. 7, авторизации нет). Нужно `FromSql($"...{status}...")` / `FromSqlInterpolated` либо LINQ `Where(o => o.Status == status)`. severity: blocker

### 2. Controllers/CustomerReportsController.cs:25-26 — загрузка всех заказов в память ради одного клиента
`db.Orders.ToListAsync()` без фильтра тянет 3 млн строк (с трекингом и lazy-прокси) в память, и только потом считает `Count` в C#. Каждый вызов summary — сотни МБ или гигабайты, OOM или многосекундная блокировка, несколько параллельных запросов роняют процесс. Нужно `CountAsync(o => o.CustomerId == customerId && o.CreatedAt >= from)` на стороне БД. severity: blocker

### 3. Controllers/CustomerReportsController.cs:28 — сериализация tracked-сущностей с lazy proxy в лог
`JsonSerializer.Serialize(orders)`: `Order.Customer` → `Customer.Orders` → `Order` образует цикл, плюс прокси подгружают `Customer`, `Lines` и все заказы клиента. Итог: `JsonException` (превышена глубина/цикл), то есть эндпоинт отдаёт 500 для любого клиента с заказами; даже если цикл обойти, это лишние запросы и десятки КБ в лог с персональными данными. Интерполированная строка вычисляется всегда, независимо от того, включён ли Debug. Нужно удалить или логировать только `customerId` и количество, через шаблон `LogDebug("... {Id}", id)`. severity: blocker

## Major

### 4. Controllers/CustomerReportsController.cs:19-22 — N+1 через lazy loading
Для каждого заказа `order.Lines` обращается к прокси и делает отдельный синхронный запрос в БД (синхронный I/O внутри async-метода). У клиента с сотнями заказов это сотни round-trip'ов и блокировка потоков пула. Нужна проекция на стороне БД: `db.OrderLines.Where(l => l.Order.CustomerId == id).SumAsync(l => l.Quantity * l.UnitPrice)` (без трекинга). severity: major

### 5. Controllers/CustomerReportsController.cs:43-49 — рассылка грузит сущности целиком, без лимита размера страницы
Материализуются `Customer` целиком (включая `Photo` bytea и `Notes`) ради одного поля `Email`; страница по умолчанию 500 строк с фото — десятки МБ на запрос. `pageSize` не ограничен сверху (`pageSize=100000000`), `page * pageSize` может переполнить int и дать отрицательный Skip (500). Нужно `.Select(c => c.Email)`, `AsNoTracking`, ограничение `pageSize` и проверка `page >= 0`. severity: major

### 6. Controllers/CustomerReportsController.cs:16 — лишнее чтение клиента
`FirstOrDefaultAsync` вытягивает `Photo` и `Notes`, хотя нужны только `Id` и `Name`; к тому же прокси трекается. Нужна проекция. severity: major

### 7. Program.cs:15-18 (все контроллеры) — нет аутентификации и авторизации
Нет `AddAuthentication`/`UseAuthorization`/`[Authorize]`. Любой анонимный вызов получает список e-mail всех клиентов с согласием на маркетинг, выгрузку заказов бухгалтерии и счета по произвольному `orderId` (перебор int). Это утечка персональных и финансовых данных. Нужна политика доступа на каждый контроллер (минимум fallback policy). severity: major

### 8. Controllers/InvoiceController.cs:22 — sync-over-async `.Result`
`rates.GetRateAsync("EUR").Result` блокирует поток пула на HTTP-вызове внешнего сервиса. При медленных курсах и нагрузке это starvation пула потоков, а при исключении оборачивается в `AggregateException`. Нужен `await`. severity: major

### 9. Controllers/InvoiceController.cs:24-33 — запрос строк счёта выполняется дважды и синхронно
`rows` объявлен как `IEnumerable<InvoiceRow>`, но это неисполненный `IQueryable`: первый запрос идёт в `rows.Sum(...)` (стр. 28), второй в `pdfRenderer.Render` при `foreach`. Между ними строки могут измениться, тогда итог в PDF не совпадёт с перечисленными позициями (это бухгалтерский документ). Оба выполнения синхронные. Нужно `await ... ToListAsync()` один раз и считать сумму по списку. Заодно сумма округлённых строк и округлённая сумма дают разные итоги, это нужно зафиксировать явно. severity: major

### 10. Controllers/InvoiceController.cs:30-31 — `Directory.EnumerateFiles` падает на отсутствующем каталоге
Если для заказа нет каталога вложений (нормальный случай), бросается `DirectoryNotFoundException` и счёт не выдаётся вообще. `config["Attachments:Root"]!` при отсутствии настройки даёт `ArgumentNullException`. Нужно `Directory.Exists` и `Any()` вместо `ToList().Count > 0`, проверку конфигурации при старте. severity: major

### 11. Services/Checksum.cs:7-19 — P/Invoke в `libz` по одному байту, непереносимая сигнатура
Вызов нативной функции на каждый байт (накладные расходы маршалинга на каждом вызове; PDF на сотни КБ даёт сотни тысяч вызовов). `libz` отсутствует на Windows, macOS и многих образах (alpine/distroless), поэтому будет `DllNotFoundException` и 500 на каждом счёте. `unsigned long` в C равен 32 битам на Windows и 64 на Linux, так что `ulong` в сигнатуре корректен не везде. Нужен `System.IO.Hashing.Crc32.Hash(body)` (управляемый, без нативных зависимостей). severity: major

### 12. Services/CurrencyConverter.cs:15-20 — сетевой вызов под `lock` в синглтоне, sync-over-async
Все конвертации сериализуются через один `_sync`, а внутри блока блокирующе ждётся HTTP-ответ. Пропускная способность равна одному запросу за раз по времени ответа сервиса курсов; при медленном ответе потоки пула копятся в очереди на lock, и приложение встаёт целиком. `lock` здесь не нужен вообще (курс не разделяемое состояние), счётчик делается через `Interlocked.Increment`. Нужен async-метод без блокировки; скоуп тоже не нужен, если `IRateService` внедряется напрямую или через фабрику. severity: major

### 13. Services/PdfRenderer.cs:14-21 — результат не является PDF
Выдаётся строка `%PDF-1.7` и дальше обычный текст, без объектов, xref и trailer. Любой просмотрщик откроет файл с ошибкой, а клиент получит «PDF-счёт», который не читается. Нужна реальная библиотека генерации PDF (QuestPDF, PdfSharp и т.п.). Контрольная сумма при этом считается от мусора. severity: major

### 14. Controllers/OrderExportController.cs:14-24 — выгрузка без ограничений в памяти
По статусу (например, `closed`) могут вернуться миллионы заказов: всё грузится в `List`, затем собирается в `StringBuilder` и ещё раз в `byte[]`. Это три копии данных, риск OOM. Нужен стриминг (`AsAsyncEnumerable` + запись в `Response.Body`), фильтр по периоду и проекция только нужных колонок. severity: major

## Minor

### 15. Controllers/OrderExportController.cs:22 — CSV зависит от культуры и не экранируется
`{o.Total}` форматируется по текущей культуре: при `ru-RU` получится `1234,56`, а разделитель столбцов `;`, и файл разъедется в Excel/1С. Поля `Number` не экранируются (`;`, кавычки, переводы строк, ведущие `=`/`+` как CSV-инъекция). Нужны `CultureInfo.InvariantCulture` и экранирование. severity: minor

### 16. Services/RateService.cs:14-15 — нет валидации и устойчивости
`currency` подставляется в путь URL без проверки (`../`, `?`), нет белого списка кодов валют. `dto!.Rate` при `null` даст NRE; нулевой или отрицательный курс даст `DivideByZeroException` (decimal) в `CurrencyConverter` и InvoiceController. Нет кэша курсов (HTTP на каждый запрос), нет таймаута и ретраев у `HttpClient` (по умолчанию 100 секунд). Нужны проверка кода валюты, `Rate > 0`, кэш на короткое время и таймаут. severity: minor

### 17. Controllers/CustomerReportsController.cs:36-37 — `CountAsync` вместо `AnyAsync`
Подсчёт всех заказов клиента ради проверки существования; `AnyAsync` останавливается на первой строке. Также нужен индекс по `orders.customer_id` (в `OrdersDbContext` ничего не настроено). severity: minor

### 18. Controllers/CustomerReportsController.cs:14,24 — `since` с `Kind=Unspecified`
Значение из query string приходит с `DateTimeKind.Unspecified`. Сейчас сравнение идёт в памяти, но после исправления п. 2 параметр уйдёт в Npgsql, который отвергает Unspecified для `timestamptz` (исключение). Нужно нормализовать к UTC (`DateTimeOffset?` или `ToUniversalTime` с явным Kind). severity: minor

### 19. Controllers/CustomerReportsController.cs:20,30 — сумма усечена до int
`LinesTotal` считается в `decimal`, но возвращается `(int)linesTotal`: копейки теряются, а на больших суммах возможен overflow. Тип поля в `CustomerSummary` должен быть `decimal`. severity: minor

### 20. Controllers/InvoiceController.cs:35-37 — лишнее копирование и `Task.Run`
`Task.Run` для CPU-операции в запросе только перекладывает работу между потоками пула; копирование тела через `Array.Copy` можно заменить `ReadOnlySpan`/`AsSpan`. `HeaderSize = 8` захардкожен в `PdfRenderer` и дублирует длину литерала; контрольная сумма считается только по телу без заголовка, поэтому получатель, проверяющий весь файл, получит несовпадение (это нужно задокументировать). severity: minor

### 21. Data/OrdersDbContext.cs:23-42 — нет конфигурации модели
Для `Total` и `UnitPrice` не задана точность (`HasPrecision`), Npgsql возьмёт `numeric` без ограничений, а поведение при миграции неочевидно. Нет индексов по `Orders.CustomerId`, `Orders.Status`, `OrderLines.OrderId`, уникальности `Customer.Email`/`Order.Number`. Все `virtual`-навигации ведут к скрытому lazy loading (см. пп. 3, 4); для отчётных сценариев лучше отказаться от `UseLazyLoadingProxies`. severity: minor
