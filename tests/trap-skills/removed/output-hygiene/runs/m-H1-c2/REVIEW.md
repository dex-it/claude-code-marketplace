# Ревью MR: feature/invoice-statement → main (BILL-24, акт сверки)

## Общий комментарий

Основа правильная: хендлер и валидатор лежат где положено (RUL-0003), деньги в минорных единицах с банковским округлением (ADR-0004), курс запрашивается в момент операции (ADR-0005). Вынос `ConvertTo` не меняет поведение котировки счёта.

Перед мёрджем нужно поправить три вещи:

1. **Баг по задаче.** Отменённые счета попадают в акт и в итог. Задача исключает черновики и отменённые.
2. **Ошибки не по ADR-0002.** Добавлен собственный `StatementHttpResults`, который отдаёт `{ error }` без `code` и превращает остальные ошибки в голый 500. Клиент API различает отказы по `code`, поэтому нужен общий `ToHttp`.
3. **Лишняя инфраструктура.** Добавлены реестр форматтеров, `StatementFormat` и `StatementRenderOptions` с группировкой по месяцам, листом и заморозкой шапки. Это заготовка под Excel из BILL-27, а в задаче BILL-27 прямо вынесена за рамки и решения по ней нет. Задача требует только JSON. Лучше убрать, а в BILL-27 проектировать под реальные требования.

Тесты не требую: задача их не требует (RUL-0002). Но по п. 1 тест на статусы был бы полезен.

## Комментарии к строкам

### src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:23
**Блокирующее.** `Status != Draft` пропускает `Cancelled`, а по задаче отменённые счета в акт не входят. Отменённый счёт попадёт в строки и завысит итог. Нужно исключить оба статуса, например `i.Status is InvoiceStatus.Issued or InvoiceStatus.Paid`. Тогда список остаётся явным, и новый статус не попадёт в акт молча.

### src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:21-24
Нит. Репозиторий отдаёт все счета клиента, а период фильтруется в памяти. На in-memory хранилище это работает, но на реальной БД выборка будет расти вместе с историей клиента. Лучше передавать период (и статусы) в `ListByCustomerAsync`. Заодно будет видно, что дата считается по `CreatedAt` в UTC. Одной строкой в задаче или комментарии стоит зафиксировать, что границы периода берутся по UTC.

### src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:28-30
Нит. Когда валюта счёта совпадает с валютой акта, делается лишний вызов справочного сервиса. Курс там всегда 1, а недоступность FX (ADR-0005) роняет весь акт. Для `currency == query.Currency` можно пропустить запрос и не пересчитывать.

### src/Billing.Api/Api/StatementHttpResults.cs:1-19
**Блокирующее.** Этот класс дублирует `ResultHttpExtensions.ToHttp`, но ведёт себя иначе:
- ответ `{ error = ... }` вместо ProblemDetails с `code` (ADR-0002);
- любой другой `BillingError` превращается в 500, хотя в `ToHttp` это 409, а 500 для бизнес-отказа неверен.

Файл нужно удалить, а в эндпоинте использовать `.ToHttp(...)`. Ответы акта тогда будут такими же, как у остальных ручек.

### src/Billing.Api/Api/StatementEndpoints.cs:17-24
Здесь та же проблема с `ToStatementResult` (см. выше). Кроме того, реестр форматтеров с единственным значением `StatementFormat.Json` и пустым `StatementRenderOptions` ничего не даёт. Достаточно `Results.Ok(...)` с проекцией, как в `quote`. Глобальные настройки JSON уже есть (`ApiModule.cs:8`, enum строками), поэтому отдельные `JsonSerializerOptions` не нужны.

### src/Billing.Api/Application/Statements/IStatementFormatter.cs:5-14
Спекулятивная часть: `StatementGrouping`, `IncludeDrafts`, `SheetName` и `FreezeHeader` нигде не используются. Они относятся к выгрузке в Excel из BILL-27, которая вне задачи. Предлагаю удалить файл целиком вместе с `StatementFormatterRegistry.cs`, `JsonStatementFormatter.cs` и регистрациями в `StatementsModule`.

### src/Billing.Api/Application/Statements/JsonStatementFormatter.cs:10
Свой `JsonStringEnumConverter` дублирует глобальную настройку из `ApiModule`. Если форматтер удалят, это отпадёт само. Если оставят, нужно использовать общие опции.

### src/Billing.Api/Application/Fx/MoneyConversion.cs:8
Без замечаний: округление `ToEven` и результат в минорных единицах соответствуют ADR-0004, поведение `QuoteInvoiceHandler` не изменилось.
