# Ревью MR: feature/invoice-statement → main (BILL-24, акт сверки)

## Общий комментарий

Спасибо, ветка собирается (`dotnet build` без предупреждений), хелпер `MoneyConversion.ConvertTo` повторяет прежнюю логику
котировки (банковское округление, ADR-0004), так что рефакторинг `QuoteInvoiceHandler` поведения не меняет. Курс берётся
синхронным вызовом на каждую валюту счетов, что соответствует ADR-0005. Структура хендлера и валидатора
соответствует RUL-0003.

Но в таком виде я бы не вливал. Есть:

**Блокирующее**
1. Отменённые счета попадают в акт и в итог, хотя задача прямо это исключает (см. комментарий к `BuildStatementHandler.cs:23`).
2. Ошибки эндпоинта отдаются не так, как принято в сервисе (ADR-0002): отдельный `StatementHttpResults` дублирует
   `ResultHttpExtensions`, теряет `code` и меняет формат ответа (см. комментарий к `StatementHttpResults.cs`).

**Нужно поправить**
3. Задача требует только JSON, а в MR добавлены реестр форматтеров, `StatementFormat`, `StatementGrouping` и опции
   рендера для Excel (`SheetName`, `FreezeHeader`), то есть заготовка под BILL-27, по которому решения нет.
   Предлагаю убрать (см. комментарий к `IStatementFormatter.cs`).
4. В задаче у строки акта есть «номер» счёта; в ответе его нет, только `invoiceId`. Если номера у счёта в модели нет,
   стоит зафиксировать это с бухгалтерией/в задаче, а не молча подменять.

**Мелочи**
5. Загрузка всех счетов клиента и фильтрация в памяти; лишний вызов FX для счетов в валюте акта.

Тесты и XML-doc не требую: задача их не требует (RUL-0001, RUL-0002). Но проверку пункта 1 (статусы и границы периода)
было бы полезно иметь, если вы решите их добавить.

## Комментарии к строкам

### `src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:23`

```csharp
.Where(i => i.Status != InvoiceStatus.Draft)
```

**Блокирующее.** В BILL-24: «Черновики и отменённые счета в акт не входят». Здесь отфильтрованы только черновики,
`Cancelled` проходит и в строки акта, и в итог, то есть итог завышен на сумму отменённых счетов. Нужно исключить и
`InvoiceStatus.Cancelled` (проще: оставлять только `Issued` и `Paid`, чтобы новый статус не попадал в акт по умолчанию).

### `src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:21`

```csharp
var customerInvoices = await invoices.ListByCustomerAsync(query.CustomerId, ct);
```

Не блокирует. Репозиторий отдаёт все счета клиента за всё время, а период и статус фильтруются в памяти. На in-memory
хранилище это незаметно, но контракт `ListByCustomerAsync` закрепляет именно такую форму. Если за ним будет реальная БД,
лучше передавать период (и статусы) в метод репозитория.

### `src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:29`

```csharp
foreach (var currency in inPeriod.Select(i => i.Amount.Currency).Distinct())
    rates[currency] = await fx.GetRateAsync(currency, query.Currency, ct);
```

Мелочь. Для счетов в валюте акта делается лишний HTTP-вызов за курсом `X→X`, а это зависимость от доступности
справочника (ADR-0005: недоступность = отказ операции). Для совпадающей валюты можно взять курс 1 без вызова. Если
курс `X→X` у FX-сервиса не ровно 1, то итог разойдётся с суммой счёта, это тоже лишний довод. Также у пустого периода
вызовов нет, это хорошо.

### `src/Billing.Api/Api/StatementHttpResults.cs:11-17`

```csharp
return result.Error switch
{
    ValidationError e => Results.BadRequest(new { error = e.Message }),
    NotFoundError e => Results.NotFound(new { error = e.Message }),
    _ => Results.StatusCode(StatusCodes.Status500InternalServerError),
};
```

**Блокирующее.** По ADR-0002 эндпоинт переводит `BillingError` в ProblemDetails с полем `code` через
`ResultHttpExtensions.ToHttp`, и клиент API различает отказы по `code`. Здесь свой переводчик: другое тело ответа
(`{ error }` вместо ProblemDetails), нет `code`, а любой прочий `BillingError` превращается в 500 вместо 409 в общем
маппинге. Фронт получит от соседних эндпоинтов и от акта разные форматы ошибок. Файл нужно удалить, а в эндпоинте
использовать `.ToHttp(...)`.

### `src/Billing.Api/Api/StatementEndpoints.cs:20-23`

```csharp
.ToStatementResult(statement =>
{
    var formatter = formatters.Resolve(StatementFormat.Json);
    return Results.File(formatter.Render(statement, new StatementRenderOptions()), formatter.ContentType);
```

Кроме замены на `ToHttp` (см. выше): ответ JSON собирается вручную в `byte[]` и отдаётся как файл через `Results.File`,
а соседний `quote` просто возвращает `Results.Ok(new { ... })`, а перечисления в JSON уже настроены в `ApiModule`
(коммит «enum в JSON строками»). Достаточно `Results.Ok(<DTO ответа>)`, с тем же результатом без форматтера,
реестра и ручной сериализации (в `JsonStatementFormatter` дублируется `JsonStringEnumConverter` из `ApiModule`).

### `src/Billing.Api/Application/Statements/IStatementFormatter.cs:3-18`

```csharp
public enum StatementFormat { Json }
public enum StatementGrouping { None, ByMonth, ByStatus }
public sealed record StatementRenderOptions(... bool IncludeDrafts, string? SheetName, bool FreezeHeader);
```

Вне задачи. В BILL-24 прямо сказано: формат только JSON, а выгрузка в Excel с группировкой по месяцам (BILL-27) в
следующем квартале и решения по ней нет. Здесь же уже есть абстракция форматтеров, реестр
(`StatementFormatterRegistry`, `NotSupportedException` для незарегистрированного), enum группировки и опции листа/заголовка
Excel. Ни одно из этих полей сейчас не читается: `Render` игнорирует `options`, `StatementGrouping` не используется,
`IncludeDrafts = false` ничего не делает и вводит в заблуждение рядом с правилом про черновики. Когда BILL-27 появится, форма
абстракции, скорее всего, будет другой. Предлагаю удалить `IStatementFormatter`, `StatementFormatterRegistry`,
`JsonStatementFormatter`, `StatementFormat`, `StatementGrouping`, `StatementRenderOptions` и регистрацию в
`StatementsModule`, оставив DTO ответа в эндпоинте.

### `src/Billing.Api/Application/Statements/JsonStatementFormatter.cs:21-31`

```csharp
lines = statement.Lines.Select(l => new { invoiceId = l.InvoiceId.Value, date = l.Date, ... })
```

В задаче в строке акта: номер, дата, сумма в валюте счёта и в валюте акта. Сумма в валюте счёта есть
(`amountMinor` + `currency`), в валюте акта `convertedMinor` без своей валюты (она только на верхнем уровне), и нет
«номера» счёта: у `Invoice` есть только `Id`. Уточните, подходит ли `invoiceId` бухгалтерии как номер. Если да, стоит
отметить это в описании MR.

### `src/Billing.Api/Application/Handlers/Statements/BuildStatementHandler.cs:22-24`

```csharp
.Where(i => InPeriod(DateOnly.FromDateTime(i.CreatedAt.UtcDateTime), query))
```

Вопрос, не замечание. Дата счёта берётся по UTC (`CreatedAt.UtcDateTime`). Для счёта, созданного в 01:00 по
местному времени, сутки могут сместиться и счёт уйдёт в соседний период. Границы включительно, как в задаче, это верно;
просто убедитесь, что бухгалтерия ожидает именно UTC-даты, и поле `date` в ответе соответствует тому же.
