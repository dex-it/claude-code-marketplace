# Ревью MR: Pricing.Api

Весь каталог - новый код, ревью построено на чтении и сверке фактов с документацией
(System.Text.Json, Microsoft.Extensions.Caching.Hybrid/Memory, MSBuild ImplicitUsings).
Сборка и dotnet не запускались - последствия компиляции выведены из документированного
поведения API, не из фактического build log.

## Blocker

### 1. Pricing.Api.csproj:1-5 - проект не имеет `ImplicitUsings`, а файлы не содержат нужных `using`
`Pricing.Api.csproj` не задаёт `<ImplicitUsings>enable</ImplicitUsings>` (в отличие от шаблонов
`dotnet new`, у "руками" собранного csproj implicit usings по умолчанию выключены). При этом ни
один файл не подключает `System`, `System.Threading`, `System.Threading.Tasks`,
`System.Collections.Generic` явно:
- `src/Contracts.cs` - вообще без `using`, но использует `Task<decimal>`, `CancellationToken`,
  `IReadOnlyList<string>`.
- `src/CatalogCache.cs:1` - только `using Microsoft.Extensions.Caching.Hybrid;`, использует
  `ValueTask<CatalogPage>`, `CancellationToken`, `Task`.
- `src/PricesController.cs:1` - только `using Microsoft.AspNetCore.Mvc;`, использует `Task<...>`,
  `CancellationToken`.
- `src/PriceService.cs:1` - только `using Microsoft.Extensions.Caching.Memory;`, использует
  `Task<decimal>`, `CancellationToken`, `TimeSpan`, `Math`.

**Чем кончится**: проект не собирается - `CS0246` на `CancellationToken`, `Task`, `ValueTask`,
`IReadOnlyList<>`, `TimeSpan`, `Math` практически во всех файлах. Это первое, что уронит CI/build,
раньше остальных находок ниже.

### 2. src/CatalogCache.cs:17 - вызван несуществующий метод `EvictByTagAsync`
```csharp
await cache.EvictByTagAsync("catalog", ct);
```
У `HybridCache` (namespace `Microsoft.Extensions.Caching.Hybrid`, пакет версии 9.3.0 из
`Pricing.Api.csproj:7`) метод для инвалидации по тегу называется `RemoveByTagAsync(string tag,
CancellationToken token = default)`. `EvictByTagAsync` - метод другого типа, `IOutputCacheStore`
(output caching ASP.NET Core), не имеет отношения к `HybridCache`. Сверено документацией
Microsoft Learn (`HybridCache.RemoveByTagAsync Method`) - подтверждён отдельный тип-владелец
`EvictByTagAsync`.

**Чем кончится**: `CS1061` - "HybridCache" does not contain a definition for "EvictByTagAsync";
инвалидация каталога по событию (заявлена в описании MR) не компилируется вовсе.

### 3. src/SupplierFeedParser.cs:10,14 - regex "вырезания комментариев" ломает JSON с URL внутри
```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```
Регэксп ищет первое вхождение `//` в строке (или до конца документа, если весь JSON - одна
строка) и вырезает от него до конца строки/документа. В файле рядом (`SupplierItem.ImageUrl`,
строка 22-23) прямо документируется, что значение этого поля - `https://cdn.supplier.example/...` -
т.е. содержит `//` внутри значения строки. Для любой строки/документа, где встречается такой URL,
всё после первого `//` (включая закрывающие кавычки/скобки/следующие поля) будет вырезано.

**Чем кончится**: при однострочной сериализации фида (дефолт `JsonSerializer`, без `WriteIndented`)
вырезается вообще всё после первого `https://` во всём документе - разбор ломает большую часть
фида или выбрасывает `JsonException` на обрезанном JSON; при построчной сериализации каждая строка
с `ImageUrl` (то есть практически каждый элемент фида) превращается в невалидный JSON. Это ломает
именно ту фичу, которую MR заявляет как "разбор JSON-фида поставщика".

### 4. src/PriceService.cs:22 - целочисленное деление гасит скидку
```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```
`discountPercent` - `int`, `100` - литерал `int`, `discountPercent / 100` - целочисленное деление.
Для любого `discountPercent` от 1 до 99 результат деления - `0`, значит `discounted == basePrice`
(скидка не применяется вовсе). Только при `discountPercent == 100` получаем `1` и `discounted == 0`.

**Чем кончится**: "финальная цена со скидкой" - фича, названная в описании MR первым пунктом -
не работает для всего диапазона скидок 1-99%, отдаёт цену без скидки. Требуется `100m` (или
`(decimal)discountPercent / 100`).

## Major

### 5. src/SupplierFeedParser.cs:8-9 - комментарий утверждает несуществующий факт про System.Text.Json
```csharp
// Поставщик кладёт в JSON-фид комментарии //. В System.Text.Json нет настройки,
// которая позволяет пропускать комментарии, поэтому вырезаем их до разбора.
```
Это не так: `JsonSerializerOptions.ReadCommentHandling = JsonCommentHandling.Skip` - штатная
настройка, которая пропускает `//`- и `/* */`-комментарии на этапе разбора (Microsoft Learn,
`JsonSerializerOptions.ReadCommentHandling Property`). Штатной настройки достаточно и она не имеет
проблемы находки №3 (не трогает содержимое строковых значений).

**Чем кончится**: неверная предпосылка в комментарии - источник самописного regex-обхода и его
бага (находка №3); при фиксе стоит убрать весь `LineComment`/`Regex` и включить
`ReadCommentHandling`, а не чинить регэксп.

### 6. src/PriceService.cs:7-8,11 + src/Contracts.cs:5 - `IMemoryCache.GetOrCreateAsync` не даёт single-flight, а поставщик банит за превышение RPS
```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```
Утверждение в комментарии не подтверждается: `CacheExtensions.GetOrCreateAsync` для
`IMemoryCache` не защищён блокировкой - при параллельных запросах на один и тот же
непопавший-в-кэш ключ фабрика вызывается по разу на каждый параллельный вызов (открытый issue
`dotnet/runtime#71581`, множество независимых источников подтверждают отсутствие де-дупликации).
Это прямо противоречит `Contracts.cs:5`: `// API поставщика: не больше 5 запросов в секунду на
ключ; превышение - бан ключа на час.`

**Чем кончится**: при каждом истечении TTL (5 минут, `PriceService.cs:13`) под нагрузкой
параллельные запросы на тот же SKU все одновременно уйдут к поставщику; при обычном трафике это
регулярно превышает 5 rps на ключ и банит ключ на час - инцидент, не гипотетика, раз лимит и
последствие уже названы в комментарии интерфейса.

### 7. src/CatalogCache.cs:15-18 - `InvalidateAsync` никем не вызывается в этом MR
```csharp
// Вызывается из обработчика события "каталог обновлён".
public async Task InvalidateAsync(CancellationToken ct)
```
В каталоге (весь код - новый) нет ни одного обработчика события "каталог обновлён" и нет ни
одного вызова `InvalidateAsync` - ни из контроллера, ни из фонового сервиса, ни из чего-либо ещё.

**Чем кончится**: заявленная в описании MR "инвалидация по событию" не подключена - метод мёртв в
границах этого MR; кэш страниц каталога не инвалидируется никогда, если обработчик события не
приедет отдельным изменением (в этом MR его нет).

### 8. src/PriceService.cs + src/PricesController.cs:19-25 - цена не инвалидируется при уведомлении о её смене
`PriceService.GetBasePriceAsync` кэширует цену на 5 минут (`PriceService.cs:13`) по ключу
`price:{sku}`. `PricesController.Notify` (единственное место в MR, связанное со сменой цены) только
шлёт POST во внешний сервис уведомлений и не трогает `IMemoryCache` вовсе.

**Чем кончится**: после смены цены у поставщика и вызова `/prices/{sku}/notify` эндпоинт
`GET /prices/{sku}` до 5 минут продолжит отдавать старую (кэшированную) базовую цену - несмотря
на то, что именно в этот момент система "узнала" о смене цены.

### 9. src/PricesController.cs:22-24 - ответ уведомления не проверяется, ошибка проглатывается
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```
Код игнорирует `HttpResponseMessage` от `PostAsync` - нет `EnsureSuccessStatusCode()`, нет
логирования, нет разбора статуса. Контроллер вернёт `202 Accepted` независимо от того, принял ли
сервис уведомлений запрос.

**Чем кончится**: "уведомление о смене цены" (пункт описания MR) может тихо не долетать -
источник узнает об ошибке только косвенно (не увидев эффекта у получателя), в логах и ответе API
следов сбоя не будет.

### 10. src/PricesController.cs:22 - относительный URI на именованном клиенте без видимой регистрации `BaseAddress`
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
```
`PostAsync` с относительным URI требует, чтобы у клиента `"notifications"` был установлен
`BaseAddress`. Регистрации `AddHttpClient("notifications", ...)` в этом MR нет (`Program.cs`/DI-
конфигурация не входят в состав файлов каталога). Не смог сверить фактически - это наблюдение по
границе MR, не подтверждённый дефект.

**Чем кончится**: если регистрация с `BaseAddress` не сделана где-то вне этого MR, каждый вызов
`Notify` бросает `InvalidOperationException` в рантайме ("An invalid request URI was provided...").
Стоит явно подтвердить наличие регистрации до мерджа.

## Minor

### 11. src/CatalogCache.cs:8-12 - использована безстейтовая перегрузка `GetOrCreateAsync`, лишняя аллокация на каждый вызов
```csharp
cache.GetOrCreateAsync(
    $"catalog:page:{page}",
    async token => await repo.LoadPageAsync(page, token),
    tags: ["catalog"],
    cancellationToken: ct);
```
Лямбда захватывает `page` в closure, что даёт аллокацию делегата на каждый вызов, включая cache
hit. Перегрузка с явным `state`-параметром (`GetOrCreateAsync<TState,T>(key, state, factory, ...)`)
избегает этой аллокации - рекомендация из документации HybridCache.

**Чем кончится**: не влияет на корректность, только на количество аллокаций на горячем пути
(страницы каталога читаются часто) - можно копить как техдолг, не блокер.

### 12. src/SupplierFeedParser.cs - регистры имён свойств JSON не проверены против реального фида поставщика
`JsonSerializer.Deserialize<SupplierFeed>(clean)` вызван без `JsonSerializerOptions` -
`PropertyNameCaseInsensitive` по умолчанию `false`. Если реальный фид поставщика использует
camelCase (`"sku"`, `"price"`, `"imageUrl"` - частая конвенция JSON API) вместо PascalCase полей
записи (`Sku`, `Price`, `ImageUrl`), значения не свяжутся с полями конструктора и тихо получат
дефолты (`0`, `null`) вместо исключения.

**Чем кончится**: при несовпадении регистра - тихая порча данных (нулевые цены/пустые URL),
а не ошибка разбора; не подтверждено образцом реального фида, отмечено как риск для проверки.

## Итог

Findings: **4 blocker, 6 major, 2 minor** (12 всего).
