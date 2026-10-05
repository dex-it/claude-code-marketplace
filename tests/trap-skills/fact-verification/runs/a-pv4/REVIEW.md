# Review: Pricing.Api (MR "Цены: базовая цена, скидка, кэш каталога, фид поставщика, уведомление")

## 1. PriceService.cs:22 — скидка не применяется из-за целочисленного деления
```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```
`discountPercent` — `int`, `100` — `int`-литерал, поэтому `discountPercent / 100` — целочисленное деление.
Для любого `discountPercent` от 1 до 99 результат деления равен `0`, то есть `discounted == basePrice`
(скидка не применяется вообще). Для `discountPercent == 100` получаем `1`, то есть `discounted == 0`
(цена всегда схлопывается в ноль). Контроллер (`PricesController.cs:14`) допускает весь диапазон 0..100,
так что баг проявляется на каждом "обычном" запросе со скидкой — ключевая функция MR ("финальная цена со
скидкой") по факту не работает.
**Severity: blocker**

## 2. PriceService.cs:5-15 — комментарий про атомарность `GetOrCreateAsync` неверен, риск бана ключа у поставщика
```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```
Здесь используется `IMemoryCache` (`Microsoft.Extensions.Caching.Memory`), а не `HybridCache`.
Однократное выполнение фабрики на ключ под конкурентной нагрузкой ("stampede protection") — это
специфика именно `HybridCache` (внутренний `StampedeState`, подтверждено документацией/исходниками
dotnet/extensions); у расширения `CacheExtensions.GetOrCreateAsync` для `IMemoryCache` такой гарантии
нет — несколько параллельных запросов на один и тот же непрогретый `sku` могут одновременно пройти
проверку "нет в кэше" и одновременно вызвать фабрику, то есть одновременно вызвать
`supplier.GetPriceAsync`. Согласно контракту поставщика (`Contracts.cs:5`: "не больше 5 запросов в
секунду на ключ; превышение - бан ключа на час"), всплеск параллельных запросов на холодный SKU может
привести к превышению лимита и часовому бану ключа — то есть к отказу всего сервиса цен на час.
Нужна явная блокировка на ключ (например, `SemaphoreSlim` на sku) либо переход на `HybridCache`,
который для каталога уже корректно используется в `CatalogCache.cs`.
**Severity: blocker**

## 3. SupplierFeedParser.cs:10,14 — вырезание `//`-комментариев регуляркой ломает JSON с URL-полями
```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```
Регулярка вырезает всё от первого `//` до конца строки — без учёта того, находится ли `//` внутри
строкового JSON-значения. Тип `SupplierItem.ImageUrl` в этом же файле (`SupplierFeedParser.cs:22`) явно
документирован как абсолютный адрес вида `https://cdn.supplier.example/img/123.png`. Как только такая
строка попадает в фид на одной строке с другими полями/скобками (стандартный minified или
pretty-printed JSON), `//` внутри `https://` триггерит регэксп, и всё, что идёт в строке после него
(остаток URL, закрывающие кавычки/скобки, последующие поля), обрезается. Итог — либо `JsonException`
из-за сломанного JSON, либо (в зависимости от того, что осталось валидным) тихая потеря данных.
Поскольку ImageUrl по контракту всегда содержит `https://`, баг проявится практически на любом реальном
фиде с картинками, а не в редком крайнем случае.
**Severity: blocker**

## 4. SupplierFeedParser.cs:15 — разбор JSON без учёта регистра имён свойств
```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```
Вызов `JsonSerializer.Deserialize` использует `JsonSerializerOptions` по умолчанию. Сопоставление имён
свойств/параметров конструктора с ключами JSON в `System.Text.Json` по умолчанию регистро-зависимое
(`PropertyNameCaseInsensitive = false` по умолчанию; подтверждено официальной документацией
`System.Text.Json/docs/SerializerProgrammingModel.md` и `ParameterizedCtorSpec.md` в dotnet/runtime).
Записи `SupplierItem`/`SupplierFeed` объявлены с PascalCase-именами (`Sku`, `Price`, `ImageUrl`,
`Items`) без `JsonPropertyName`, `PropertyNamingPolicy` или `PropertyNameCaseInsensitive`. Если фид
поставщика (как подавляющее большинство внешних JSON API) использует camelCase или lowercase ключи
(`sku`, `price`, `imageUrl`, `items`), значения не свяжутся с параметрами конструктора — поля получат
значения по умолчанию (`null`/`0`) без явной ошибки, либо разбор завершится иначе в зависимости от
точной конфигурации — в любом случае результат не соответствует реальным данным фида. Код не
подтверждает регистр ключей поставщика и не настраивает сериализатор под него.
**Severity: major**

## 5. PricesController.cs:23 — SKU подставляется в URL уведомления без экранирования
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
```
`sku` берётся из маршрута (`[HttpPost("{sku}/notify")]`) и напрямую интерполируется в путь запроса без
`Uri.EscapeDataString`/аналогичного кодирования. После декодирования ASP.NET маршрутизацией значение
`sku` может содержать символы вроде `?`, `#`, `%2F` и т.п., которые при повторной сборке строки
превращаются в управляющие символы URL (начало query-string, фрагмента и т.д.). Это позволяет изменить
путь или добавить произвольные query-параметры в запросе к сервису уведомлений (переход на другой
маршрут/эндпоинт в пределах `BaseAddress` клиента "notifications"), то есть манипулировать тем, куда и
с какими параметрами уходит запрос.
**Severity: major**

## 6. PricesController.cs:22-24 — результат отправки уведомления не проверяется
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```
Код не проверяет `HttpResponseMessage` (`EnsureSuccessStatusCode` не вызывается) и не логирует результат
отправки. Если сервис уведомлений ответит 4xx/5xx или окажется недоступен, вызывающая сторона всё равно
получит `202 Accepted` и не узнает, что уведомление о смене цены не доставлено — отказ уходит молча.
**Severity: minor**

---

## Итог по severity
- blocker: 3
- major: 2
- minor: 1
