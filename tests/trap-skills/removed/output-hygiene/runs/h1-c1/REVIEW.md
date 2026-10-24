# Ревью MR: feature/invoice-statement -> main (BILL-24, акт сверки)

## Общий комментарий

Сборка зелёная (`dotnet build src/Billing.Api`, 0 предупреждений). Рефакторинг котировки на `MoneyConversion.ConvertTo`
поведение не меняет: то же банковское округление, что в ADR-0004. Структура хендлера и валидатора
соответствует RUL-0003. Тестов нет - задача их не требует, не замечание (RUL-0002).

Блокирует слияние один пункт: в акт попадают отменённые счета, хотя задача их исключает. Остальное -
лишний код сверх задачи и ответ с ошибкой не в формате сервиса.

| # | Важность | Суть |
|---|---|---|
| 1 | blocker | в акте остаются отменённые счета и искажают итог |
| 2 | major | опции Excel/группировки и реестр форматтеров - то, что задача выводит за рамки (BILL-27) |
| 3 | major | `StatementHttpResults` дублирует `ToHttp` и ломает формат ошибок из ADR-0002 |

## Комментарии к строкам

### src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:23

**blocker.** Фильтр `i.Status != InvoiceStatus.Draft` пропускает `Cancelled`. В BILL-24 сказано:
«Черновики и отменённые счета в акт не входят». Сейчас отменённый счёт попадает в `lines` и в
`total`, акт сверки завышен на сумму отменённых.

Предложение:

```csharp
.Where(i => i.Status is InvoiceStatus.Issued or InvoiceStatus.Paid)
```

Список разрешённых статусов надёжнее запрета: новый статус сам в акт не попадёт. Нужен тест на
отменённый счёт в периоде.

### src/Billing.Api/Application/Statements/IStatementFormatter.cs:5-11

**major.** `StatementGrouping` (`ByMonth`, `ByStatus`) и `StatementRenderOptions` (`IncludeDrafts`,
`SheetName`, `FreezeHeader`) - заготовка под Excel-выгрузку с группировкой по месяцам. Задача
называет её вне охвата (BILL-27, «решения по ней нет»). Ни одно поле опций не читается:
`JsonStatementFormatter.Render` параметр `options` игнорирует, эндпоинт передаёт пустой
`new StatementRenderOptions()`. `IncludeDrafts` к тому же противоречит задаче, где черновиков в акте нет.
Формат ответа в задаче один - JSON.

Предложение: убрать enum'ы и `StatementRenderOptions`. Форму будущей выгрузки определит BILL-27, когда
по ней будет решение.

### src/Billing.Api/Application/Statements/StatementFormatterRegistry.cs:3

**major.** Интерфейс `IStatementFormatter`, реестр и enum `StatementFormat { Json }` обслуживают единственную
реализацию, а эндпоинт всё равно жёстко вызывает `Resolve(StatementFormat.Json)`. Выбора формата нет
ни в запросе, ни в коде, а в DI появились лишние регистрации. В обработке запроса остаётся путь
`NotSupportedException`, который недостижим.

Предложение: убрать `IStatementFormatter`, `StatementFormatterRegistry`, `JsonStatementFormatter`,
`StatementFormat`, а в эндпоинте вернуть DTO ответа через `Results.Ok(...)`. Тогда сериализацию (camelCase,
enum строкой) задаст общая конфигурация JSON минимального API, как у остальных эндпоинтов
(`/invoices/{id}/quote`). Если форматтеры понадобятся под BILL-27, их добавят вместе с
этой задачей.

### src/Billing.Api/Api/StatementEndpoints.cs:22-23

**minor.** `Results.File(byte[], contentType)` для JSON - не то, что делают остальные эндпоинты
сервиса (`Results.Ok`), и для клиента ответ оформляется как файл. Снимается вместе с замечанием
выше.

### src/Billing.Api/Api/StatementHttpResults.cs:9-18

**major.** `ToStatementResult` повторяет `ResultHttpExtensions.ToHttp` с другим поведением. По ADR-0002 эндпоинт
переводит `BillingError` в ProblemDetails с полем `code`, по которому клиент различает отказ.
Здесь ошибки отдаются как `{ error = ... }` без `code`, а любая другая `BillingError`
превращается в 500 без тела, хотя `ToHttp` отдаёт 409. Клиенты сервиса получат на двух
группах эндпоинтов два формата ошибок.

Предложение: удалить файл, в эндпоинте использовать `.ToHttp(statement => Results.Ok(...))`.

## Вопрос без блокировки

`BuildStatementHandler.cs:24`: период считается по дате `CreatedAt` в UTC. Если бухгалтерия
считает период по локальной дате (счёт в 23:30 по Москве 31-го попадёт в следующий период), границы
разойдутся. В задаче часовой пояс не назван - стоит подтвердить с автором задачи и отразить
в BILL-24.
