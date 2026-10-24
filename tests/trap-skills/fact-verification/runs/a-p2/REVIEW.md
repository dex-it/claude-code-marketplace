# Review: Pricing.Api MR

Ревью нового кода (весь каталог - диф MR). Сборка/dotnet не запускались - анализ по чтению кода
и сверке фактов о платформе (System.Text.Json, Microsoft.Extensions.Caching.Hybrid/Memory) с
официальной документацией .NET 9 (learn.microsoft.com) через веб-поиск, т.к. context7 вернул
"Monthly quota exceeded".

## Blocker

### 1. `src/CatalogCache.cs:17` - вызван несуществующий метод `EvictByTagAsync`
```csharp
await cache.EvictByTagAsync("catalog", ct);
```
У `HybridCache` (Microsoft.Extensions.Caching.Hybrid 9.3.0) такого метода нет - есть
`RemoveByTagAsync(string tag, CancellationToken cancellationToken = default)`
(learn.microsoft.com/.../hybridcache.removebytagasync). Чем кончится: сборка проекта не пройдёт -
`CatalogCache`, а с ним и любой код, который на него ссылается, не компилируется. Инвалидация
кэша каталога по событию, заявленная в описании MR, физически не существует в собранном виде.

### 2. `src/PriceService.cs:22` - скидка не применяется из-за целочисленного деления
```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```
`discountPercent` - `int`, `discountPercent / 100` - целочисленное деление: для любого
`discountPercent` от 1 до 99 результат равен `0` (округление к нулю), и `discounted == basePrice`
- скидка не вычитается вовсе. Для `discountPercent == 100` результат `1`, и `discounted == 0`
(это единственный случай, где формула случайно верна). Чем кончится: эндпоинт `GET /prices/{sku}`
для любой скидки 1-99% отдаёт полную (недисконтированную) цену - основная функция MR "финальная
цена со скидкой" не работает почти во всём диапазоне входа. Нужно `discountPercent / 100m` (или
`basePrice * discountPercent / 100`).

### 3. `src/SupplierFeedParser.cs:10,14` - вырезание `//`-комментариев ломает поле `ImageUrl`
```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```
Сам файл документирует формат поля: `ImageUrl` - `https://cdn.supplier.example/img/123.png`
(`SupplierFeedParser.cs:22`). Регэксп `//.*$` не различает JSON-комментарий и `//` внутри строкового
значения URL: он срежет от первого `//` до конца строки, т.е. заберёт с собой хвост URL и закрывающую
кавычку значения `imageUrl`. Чем кончится: для фида, где `imageUrl` и остаток объекта не на одной
физической строке, получившийся текст содержит незакрытую строковую кавычку, продолжающуюся на
следующей "JSON-строке" - `JsonSerializer.Deserialize` бросает `JsonException` (control character in
string / invalid JSON) на первом же товаре с картинкой; для однострочного (минифицированного) фида
обрежется весь хвост документа после первого URL. Разбор фида поставщика, который является целью
MR, детерминированно ломается на собственном контрактном примере поля.

## Major

### 4. `src/PriceService.cs:7-8,11-15` - комментарий и код полагаются на несуществующую гарантию single-flight у `IMemoryCache`
```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```
Это не так для `Microsoft.Extensions.Caching.Memory.IMemoryCache` - в отличие от `HybridCache`
(у которой действительно есть stampede protection), `IMemoryCacheExtensions.GetOrCreateAsync`
не делает per-key блокировку: при параллельных запросах на холодный ключ фабрика может быть вызвана
несколько раз одновременно (документированное, известное поведение, см.
github.com/dotnet/runtime/issues/36499, github.com/dotnet/extensions/issues/1242). Чем кончится:
`ISupplierClient.GetPriceAsync` (`Contracts.cs:5-6`) сопровождён явным контрактом поставщика - "не
больше 5 запросов в секунду на ключ; превышение - бан ключа на час". Одновременный всплеск запросов
на один `sku` после истечения 5-минутного TTL (или холодный старт) может дать несколько параллельных
вызовов `GetPriceAsync` для одного и того же `sku` и реально исчерпать лимит поставщика - с баном ключа
на час для всего сервиса. Нужна per-key синхронизация (`SemaphoreSlim` на ключ или переход на
`HybridCache`, которая для этого и существует).

### 5. `src/PricesController.cs:22-24` - результат уведомления не проверяется
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```
`HttpClient.PostAsync` не бросает исключение на неуспешный HTTP-статус (4xx/5xx) - для этого нужен
явный `EnsureSuccessStatusCode()` или проверка `response.IsSuccessStatusCode`. Здесь ответ вообще не
читается. Чем кончится: если получатель уведомления вернёт ошибку (например, временно недоступен,
занят, отверг payload), контроллер всё равно отдаёт `202 Accepted` вызывающей стороне - потеря
уведомления о смене цены проходит незамеченной, при этом ни лога, ни retry нет.

### 6. `src/SupplierFeedParser.cs:15,20,23` - десериализация без учёта регистра имён свойств
```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean) ?? throw ...;
...
public sealed record SupplierFeed(IReadOnlyList<SupplierItem> Items);
public sealed record SupplierItem(string Sku, decimal Price, string ImageUrl);
```
Вызов не передаёт `JsonSerializerOptions`, свойства записей не помечены `[JsonPropertyName]`.
`System.Text.Json.JsonSerializer` по умолчанию сопоставляет имена свойств JSON и типа
**с учётом регистра** (`PropertyNameCaseInsensitive` по умолчанию `false`,
learn.microsoft.com/.../jsonserializeroptions.propertynamecaseinsensitive). Если фид поставщика
(как большинство JSON API) использует `camelCase` (`items`, `sku`, `price`, `imageUrl`) - что не
подтверждено и не исключено ни одним файлом в этом MR, - десериализация не бросит исключение, а
молча подставит `default` (`null` для `string`/списка, `0` для `decimal`) во все поля каждого
элемента: `?? throw` в `Parse` страхует только от `null` на верхнем уровне (буквальный `null`/пустой
JSON), а не от "успешно" собранного объекта из одних дефолтов. Чем кончится (если предположение о
`camelCase`-фиде верно): цены поставщика читаются как `0`, `Sku`/`ImageUrl` как `null`, без единого
исключения по всей цепочке - обнаружится только по данным ниже по потоку. Нужен образец реального
фида, чтобы снять или подтвердить находку; на файлах этого MR не хватает ни `JsonSerializerOptions`,
ни атрибутов, которые обезопасили бы от расхождения в регистре.

## Minor

### 7. `src/PriceService.cs:23` - округление скидочной цены без явного режима
```csharp
return Math.Round(discounted, 2);
```
Без `MidpointRounding` `Math.Round` использует `MidpointRounding.ToEven` (банковское округление) -
для денежных величин многие продуктовые требования ожидают `AwayFromZero`. Явного требования в
описании MR нет, но выбор режима сейчас не задокументирован и не осознан - молчаливый дефолт на
денежной величине.

### 8. `src/CatalogCache.cs:15-18` (после исправления находки 1) - `RemoveByTagAsync` не физическое удаление
По документации `HybridCache.RemoveByTagAsync` - логическая операция ("игнорировать всё, что
создано раньше этого момента" для записей с тегом), а не немедленное удаление из L1/L2 хранилища;
ни `IMemoryCache`, ни `IDistributedCache` не имеют встроенной поддержки тегов сами по себе. Для
локального кэша это не проблема, но для распределённого backing store (Redis, судя по
`Microsoft.Extensions.Caching.StackExchangeRedis` в `Pricing.Api.csproj:8`) это значит, что
инвалидированные страницы каталога физически останутся в Redis до истечения их TTL, а не исчезнут
в момент события. Комментарий `CatalogCache.cs:14` ("Вызывается из обработчика события 'каталог
обновлён'") не проговаривает эту особенность - стоит явно задокументировать, иначе при
инспекции Redis это выглядит как утечка/баг инвалидации.

## Итог

Blocker: 3, Major: 3, Minor: 2.
