# Ревью MR - Pricing.Api

Область: весь каталог (новый код). Ревью без сборки/dotnet, без запуска кода - находки по чтению
и по сверке фактов о поведении библиотек с официальной документацией (context7 был недоступен -
квота исчерпана - источник fallback: learn.microsoft.com, WebSearch по официальным блогам/issue
dotnet).

## Находки

### 1. src/CatalogCache.cs:17 - вызов несуществующего метода `HybridCache.EvictByTagAsync`

```csharp
await cache.EvictByTagAsync("catalog", ct);
```

`HybridCache` (namespace `Microsoft.Extensions.Caching.Hybrid`, пакет версии 9.3.0 из
`Pricing.Api.csproj:7`) не имеет метода `EvictByTagAsync`. По официальному референсу API
(Microsoft Learn, класс `HybridCache`) метод для удаления по тегу называется `RemoveByTagAsync`
(`RemoveByTagAsync(string, CancellationToken)` / `RemoveByTagAsync(IEnumerable<string>, CancellationToken)`).
Имя `EvictByTagAsync` принадлежит другому API - `IOutputCacheStore` (ASP.NET Core response
caching), похожая, но другая абстракция; вероятная причина - спутали два кэш-API с похожей
терминологией (issue dotnet/aspnetcore #55332 обсуждает именно унификацию "Evict/Remove" между
этими двумя типами).

**Чем кончится**: код не компилируется - весь проект не собирается, фича "инвалидация каталога по
событию" и все остальные фичи MR не доезжают ни до одного окружения.

**Severity**: blocker.

### 2. src/PriceService.cs:22 - целочисленное деление убивает скидку

```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```

`discountPercent` (int) и `100` (int) - `discountPercent / 100` выполняется как целочисленное
деление и обрезается до `0` для любого `discountPercent` в диапазоне 1..99 (единица получается
только при `discountPercent == 100`). Контроллер (`PricesController.cs:14`) допускает как раз этот
диапазон (`0..100`).

**Чем кончится**: `GetFinalPriceAsync` возвращает `basePrice` без изменений для любой скидки
1-99% - ключевая фича MR ("финальная цена со скидкой") не работает почти во всём диапазоне
входа, скидка молча теряется, деньги/цена показываются некорректно без единой ошибки в логах.

**Severity**: blocker.

### 3. src/SupplierFeedParser.cs:10,14 - regex-вырезание `//`-комментариев ломается на URL

```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```

`ImageUrl` (см. комментарий `SupplierFeedParser.cs:22` и запись `SupplierItem.cs:23`) - абсолютный
URL вида `https://cdn.supplier.example/img/123.png`. Регэксп не отличает "настоящий" `//`-комментарий
от `//` внутри строкового литерала JSON: он матчит от первого вхождения `//` (в `https://...`)
до конца строки/входа и вырезает остаток, включая закрывающую кавычку значения. Поведение не
зависит от того, стоит фид в одну строку или отформатирован - меняется только объём того, что
будет вырезано (весь хвост фида после первого URL, либо содержимое одной строки).

**Чем кончится**: `JsonSerializer.Deserialize<SupplierFeed>` получает на входе синтаксически
невалидный JSON (незакрытая строка) и бросает `JsonException` на первом же элементе с `ImageUrl` -
разбор фида поставщика не работает практически никогда, если в фиде реально есть URL-адреса.

**Severity**: blocker.

### 4. src/PriceService.cs:7-8 (комментарий) и 9-17 - `IMemoryCache.GetOrCreateAsync` не даёт single-flight

```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```

Факт сверен (context7 недоступен - квота; сверено официальным блогом .NET и issue
dotnet/runtime#71581 через WebSearch): `CacheExtensions.GetOrCreateAsync` на `IMemoryCache` - это
`TryGetValue`, затем (при мисе) вызов фабрики, без атомарности и без блокировки; при параллельных
запросах на один ключ фабрика может и будет вызвана несколько раз одновременно. Это гарантирует
именно `HybridCache` (использован в `CatalogCache.cs`), а не `IMemoryCache`. Комментарий в коде
описывает поведение `HybridCache`, а применён к `IMemoryCache` - утверждение неверное для
использованного типа.

`ISupplierClient.GetPriceAsync` (Contracts.cs:5) документирован с жёстким лимитом: "не больше 5
запросов в секунду на ключ; превышение - бан ключа на час".

**Чем кончится**: при параллельных запросах на один и тот же `sku` в момент промаха кэша (истечение
5-минутного TTL под нагрузкой на популярный SKU) `supplier.GetPriceAsync` уйдёт в поставщика
несколько раз одновременно вместо одного - конкурентная нагрузка на популярные SKU легко пробивает
лимит 5 rps и банит интеграционный ключ на час, что останавливает получение базовой цены для всех
SKU до конца бана.

**Severity**: blocker.

### 5. src/PricesController.cs:19-25 - уведомление без содержимого и без проверки результата

```csharp
[HttpPost("{sku}/notify")]
public async Task<IActionResult> Notify(string sku, CancellationToken ct)
{
    var client = httpFactory.CreateClient("notifications");
    await client.PostAsync($"/price-changed/{sku}", null, ct);
    return Accepted();
}
```

Тело запроса - `null`: получатель узнаёт только `sku`, без старой/новой цены. `HttpResponseMessage`
от `PostAsync` не сохраняется и не проверяется (`EnsureSuccessStatusCode` или аналог) - при любом
не-успешном статусе (4xx/5xx) от получателя контроллер всё равно вернёт `202 Accepted`, и ни лог,
ни ответ не покажут, что уведомление не доставлено.

**Чем кончится**: "уведомление о смене цены" из описания MR превращается в непроверяемый пинг без
данных о цене; неудачная доставка уведомления никак не наблюдаема снаружи метода.

**Severity**: major.

### 6. src/CatalogCache.cs:7-8 - `GetPageAsync` не валидирует `page`

```csharp
public ValueTask<CatalogPage> GetPageAsync(int page, CancellationToken ct) =>
    cache.GetOrCreateAsync($"catalog:page:{page}", ...);
```

Нет проверки `page >= 0` (или иной нижней/верхней границы) перед построением ключа кэша и вызовом
`repo.LoadPageAsync`. Валидация в `ICatalogRepository.LoadPageAsync` не видна (реализация не входит
в этот MR).

**Чем кончится**: произвольные (в т.ч. отрицательные) значения `page` от вызывающего кода без
контроля создают отдельные записи кэша под непредусмотренными ключами; поведение при таком `page`
на стороне репозитория неизвестно и не проверяется здесь.

**Severity**: minor.

### 7. src/PriceService.cs:23 - `Math.Round` с дефолтным `MidpointRounding.ToEven`

```csharp
return Math.Round(discounted, 2);
```

Без явного указания режима округления действует `MidpointRounding.ToEven` (банковское округление);
для денежных сумм чаще ожидается `AwayFromZero`. В MR нет явного решения по режиму округления цены.

**Чем кончится**: цены на границе `x.xx5` округляются не так, как ожидает большинство пользователей
и как обычно считает сам поставщик/бухгалтерия, без видимой ошибки - несовпадение сумм на копейку
в отдельных SKU.

**Severity**: minor.

### 8. src/SupplierFeedParser.cs:15 - `Deserialize` без `PropertyNameCaseInsensitive`

```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```

Вызов без `JsonSerializerOptions` - сопоставление имён свойств регистро-зависимое (дефолт STJ:
`PropertyNameCaseInsensitive = false`). Записи `SupplierFeed`/`SupplierItem` объявлены с
PascalCase-именами (`Items`, `Sku`, `Price`, `ImageUrl`). Реальная схема фида поставщика в этом MR
не приведена; если фид отдаёт camelCase-ключи (типичная практика JSON API), совпадений не будет.

**Чем кончится** (условно, при камелкейс-фиде поставщика): элементы десериализуются без ошибки, но
с дефолтными значениями (`Price = 0`, `Sku = null`, `ImageUrl = null`) - тихая порча данных без
единого исключения, дополнительно накладывается на находку №3.

**Severity**: minor.

## Итог по severity

- blocker: 4 (находки 1, 2, 3, 4)
- major: 1 (находка 5)
- minor: 3 (находки 6, 7, 8)

Итого находок: 8.
