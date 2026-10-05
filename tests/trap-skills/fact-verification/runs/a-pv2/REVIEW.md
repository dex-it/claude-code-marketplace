# Review: Pricing.Api (MR "Цены: базовая цена поставщика с кэшем, скидка, кэш каталога, JSON-фид, уведомление")

## Blocker

### 1. `src/PriceService.cs:22` — скидка не применяется из-за целочисленного деления
```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```
`discountPercent` и `100` оба `int`, поэтому `discountPercent / 100` — целочисленное деление.
Для любого `discountPercent` от 1 до 99 результат деления равен `0`, то есть `discounted == basePrice`
(скидка не применяется вообще). При `discountPercent == 100` результат деления — `1`, и цена становится `0`
(тоже неверно для промежуточных значений, но по случайному совпадению "работает" на границе).
**Чем кончится:** клиент API получает скидку только для значений `0` и `100`, во всех остальных случаях —
полную цену без скидки. Это основная заявленная в MR функциональность ("финальная цена со скидкой"),
она не работает.
**Severity:** blocker.

### 2. `src/PriceService.cs:7-8,11` — комментарий и код ошибочно полагаются на отсутствующую защиту от stampede в `IMemoryCache`
```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```
Факт проверен (поиск по официальным источникам/блогам о HybridCache в .NET 9): `Microsoft.Extensions.Caching.Memory.IMemoryCache.GetOrCreateAsync`
**не гарантирует** однократный вызов фабрики на ключ при параллельных запросах — это именно та проблема
("cache stampede"), ради решения которой в .NET 9 введён `HybridCache` (который в этом же PR корректно
используется в `CatalogCache.cs` с явной целью "защита от stampede"). При конкурентных запросах на тот же
`sku` в момент промаха/истечения кэша (раз в 5 минут) фабрика может быть вызвана параллельно много раз.
Согласно `src/Contracts.cs:5`, поставщик банит ключ на час при превышении 5 запросов/сек на ключ.
**Чем кончится:** всплеск параллельных запросов на популярный SKU в момент истечения кэша (каждые 5 минут)
может превысить лимit 5 rps и привести к часовому бану API-ключа поставщика — ценообразование перестанет
работать для всех SKU на час.
**Severity:** blocker.

### 3. `src/SupplierFeedParser.cs:10,14` (демонстрируется примером на строке 22-23) — regex "вырезания комментариев" ломает JSON с URL-строками
```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```
Регулярка вырезает всё от первого `//` до конца строки — но абсолютные URL вида `https://...`
(ровно то, что по документации PR лежит в `ImageUrl`, см. `SupplierItem.ImageUrl` и комментарий-пример на
строке 22: `https://cdn.supplier.example/img/123.png`) тоже содержат `//`. Для любой строки JSON-фида,
где встречается `ImageUrl` с абсолютным адресом, всё после `https:` до конца строки (включая закрывающие
кавычку/скобки/запятую, а при минифицированном в одну строку фиде — вообще весь остаток документа) будет
вырезано.
**Чем кончится:** разбор фида поставщика либо падает с `JsonException` из-за битого JSON, либо (в
pretty-printed фиде построчно) молча обрезает `ImageUrl` и ломает структуру объекта. Это основная
заявленная функциональность MR ("разбор JSON-фида поставщика"), она не работает на собственном же примере
данных из комментария авторов кода.
**Severity:** blocker.

## Major

### 4. `src/PricesController.cs:22-24` — результат уведомления не проверяется, ошибки поставщика уведомлений проглатываются
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```
Код не проверяет `HttpResponseMessage.IsSuccessStatusCode` / не вызывает `EnsureSuccessStatusCode()`.
Если сервис уведомлений ответит 4xx/5xx, `PostAsync` всё равно успешно вернёт `HttpResponseMessage`
(не бросит исключение), и контроллер безусловно вернёт `202 Accepted` вызывающей стороне.
**Чем кончится:** уведомления о смене цены могут не доходить до получателя, при этом ни лог, ни
HTTP-ответ не сигнализируют об ошибке — отказ незаметен для вызывающей стороны и для мониторинга.
**Severity:** major.

### 5. `src/PricesController.cs:22-23` — относительный URI для именованного `HttpClient` без видимой конфигурации `BaseAddress`
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
```
`PostAsync` вызывается с относительным путём (`/price-changed/{sku}`), что требует установленного
`HttpClient.BaseAddress`. В просмотренном коде нет ни одного места (`Program.cs`/`Startup`/DI-регистрации
`AddHttpClient("notifications", ...)` в ревью отсутствуют) из этого MR, где настраивается именованный
клиент `"notifications"`. Если конфигурация действительно отсутствует (а по условиям задачи весь каталог —
новый код этого MR), `IHttpClientFactory.CreateClient("notifications")` вернёт клиент без `BaseAddress`.
**Чем кончится:** при вызове `Notify` каждый раз будет брошено `InvalidOperationException`
("An invalid request URI was provided. The request URI must either be an absolute URI or BaseAddress must
be set") — ручка `/prices/{sku}/notify` не будет работать вообще. Если регистрация клиента на самом деле
есть в не вошедшем в ревью файле — риск ниже, но в показанном коде подтверждения нет.
**Severity:** major (при отсутствии конфигурации вне ревью — фактически blocker).

### 6. `src/SupplierFeedParser.cs:15` — десериализация без учёта регистра полей фида
```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```
`JsonSerializer.Deserialize` вызван без `JsonSerializerOptions`. По умолчанию
`PropertyNameCaseInsensitive == false`, то есть имена полей JSON должны буквально совпадать с именами
свойств записи (`Sku`, `Price`, `ImageUrl`, см. `SupplierFeed`/`SupplierItem`). Внешние JSON-фиды от
поставщиков обычно используют `camelCase`/`snake_case` (`sku`, `price`, `imageUrl`). При несовпадении
регистра/формата имени десериализация не бросает исключение, а молча проставляет значения по умолчанию
(`null` для `string`, `0` для `decimal`) для несопоставленных полей.
**Чем кончится:** если реальный формат полей поставщика отличается от PascalCase, фид "успешно"
распарсится с нулевыми ценами и пустыми `Sku`/`ImageUrl`, ошибка будет не видна на этапе парсинга и
проявится только в виде неверных данных ниже по потоку.
**Severity:** major.

## Minor

### 7. `src/SupplierFeedParser.cs:15-16` — недостижимая/вводящая в заблуждение ветка обработки "пустого" фида
```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```
`JsonSerializer.Deserialize<T>` возвращает `null` только когда входная строка — буквально JSON `null`.
Для пустой строки или строки, ставшей пустой/некорректной после вырезания комментариев (см. находку 3),
метод бросает `JsonException`, а не возвращает `null` — то есть этот `?? throw` обрабатывает маловероятный
случай, а реальный источник падений (битый JSON после вырезания `//`) остаётся непойманным и
необработанным (наружу уходит сырой `JsonException` без контекста "фид поставщика").
**Чем кончится:** на практике при реальных сбоях парсинга наружу летит малоинформативное исключение
`JsonException` вместо осмысленного сообщения — усложняет диагностику, но не меняет поведение системы.
**Severity:** minor.
