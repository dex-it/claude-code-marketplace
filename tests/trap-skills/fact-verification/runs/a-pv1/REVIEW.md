# Ревью MR: Pricing.Api

Весь каталог — новый код. Ниже находки по файлам, отсортированы по severity.
Факты о поведении библиотек (System.Text.Json, IMemoryCache, HybridCache) сверены
с официальной документацией/API-референсом Microsoft Learn на момент ревью
(дисциплина fact-verification из SKILL.md) — источники указаны прямо в находках.

## Blocker

### 1. CatalogCache.cs:17 — вызов несуществующего метода `HybridCache.EvictByTagAsync`
```csharp
await cache.EvictByTagAsync("catalog", ct);
```
В установленном пакете `Microsoft.Extensions.Caching.Hybrid` (csproj: версия 9.3.0,
релиз после выхода .NET 9 GA) у класса `HybridCache` нет метода `EvictByTagAsync`.
Метод для инвалидации по тегу называется `RemoveByTagAsync(string, CancellationToken)`
/ `RemoveByTagAsync(IEnumerable<string>, CancellationToken)` — проверено по актуальному
API-референсу `HybridCache` на learn.microsoft.com (microsoft.extensions.caching.hybrid.hybridcache),
в списке методов есть `RemoveByTagAsync`, `EvictByTagAsync` отсутствует.
(Имя `EvictByTagAsync` использовалось только в ранних превью до финального релиза
.NET 9 HybridCache и было переименовано до GA.)
**Чем кончится:** проект не компилируется — ни сборка, ни фича инвалидации кэша
каталога по событию не работают вообще.
**Severity:** blocker.

### 2. PriceService.cs:22 — целочисленное деление ломает расчёт скидки
```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```
`discountPercent` — `int`, `100` — `int`, поэтому `discountPercent / 100` выполняется
как целочисленное деление и округляется в сторону нуля: для любого `discountPercent`
от 1 до 99 результат — `0`. Скидка применяется только при `discountPercent == 100`
(полный ноль цены) или вырождается в `0 * basePrice` — то есть **ни одна скидка
от 1% до 99% не применяется**, финальная цена всегда равна базовой.
**Чем кончится:** ключевая фича MR "финальная цена со скидкой" не работает ни при
одном реалистичном значении скидки — пользователь получает базовую цену вместо
цены со скидкой, либо (при 100%) цену 0.
**Severity:** blocker.

### 3. SupplierFeedParser.cs:10 и :14 — regex-вырезание комментариев портит сам JSON
```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```
Регэксп `//.*$` вырезает всё от первого `//` до конца строки — без различения,
находится ли `//` внутри `//`-комментария поставщика или внутри обычной JSON-строки.
Но тип `SupplierItem.ImageUrl` в этом же файле (строка 23, комментарий к полю) явно
документирован как абсолютный URL вида `https://cdn.supplier.example/img/123.png` —
то есть содержит `//` сразу после `https:`. Как только в фиде встречается такое
значение `ImageUrl`, regex обрежет строку начиная с `//` в `https://`, удалив
остаток URL и (если фид однострочный/минифицированный, что типично для фида
поставщика) весь хвост JSON на этой строке — закрывающие скобки, кавычки,
последующие элементы массива.
**Чем кончится:** `ImageUrl` обрезается до `https:` либо весь JSON ломается и
`JsonSerializer.Deserialize` бросает `JsonException`, либо часть элементов фида
пропадает без ошибки. Разбор фида поставщика — одна из заявленных фич MR —
не работает на реальных данных с картинками.
**Severity:** blocker.

## Major

### 4. PriceService.cs:7-8 (комментарий) / :11-15 — неверное утверждение о гарантии `IMemoryCache.GetOrCreateAsync`, нет защиты от "cache stampede"
```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```
Это утверждение верно для `HybridCache` (используется в `CatalogCache.cs`, раздел
"Stampede protection" в официальном guide по кэшированию на learn.microsoft.com:
"Only one request fetches the data while others wait for the result" — именно
про `HybridCache`), но **не** для `Microsoft.Extensions.Caching.Memory.IMemoryCache`.
Для `IMemoryCache.GetOrCreateAsync` такой гарантии официально не дано: тот же
guide в разделе про in-memory caching явно показывает, что для сериализации
конкурентных обращений к фабрике нужно вручную оборачивать вызов в
`SemaphoreSlim` (пример `CacheSignal`) — то есть сам `IMemoryCache` этого не делает;
расхождение поведения также отражено в открытой проблеме дотнета
(dotnet/extensions#1242, "factory method provided may get executed for the same
key in parallel"). Похоже, что поведение `HybridCache` (использован в `CatalogCache`)
перепутали с поведением `IMemoryCache` (использован здесь).
**Чем кончится:** при параллельных запросах на один и тот же `sku` в момент
отсутствия/истечения записи в кэше `supplier.GetPriceAsync` может вызваться
несколько раз одновременно. Согласно `Contracts.cs:5` у поставщика лимит
"не больше 5 запросов в секунду на ключ; превышение — бан ключа на час" — всплеск
параллельных запросов на популярный sku сразу после истечения 5-минутного TTL
кэша может пробить лимит и получить бан ключа на час, полностью обрушив
получение базовых цен.
**Severity:** major.

### 5. SupplierFeedParser.cs:15 — десериализация без `JsonSerializerOptions`, молчаливая потеря данных при несовпадении регистра имён полей
```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```
`SupplierItem`/`SupplierFeed` — record'ы, их поля (`Sku`, `Price`, `ImageUrl`,
`Items`) в PascalCase (`SupplierFeedParser.cs:20,23`). По умолчанию
`System.Text.Json` сопоставляет имя JSON-свойства с параметром конструктора
кейс-сенситивно (`PropertyNameCaseInsensitive` по умолчанию `false`), и по
умолчанию `RespectRequiredConstructorParameters` выключен — то есть отсутствующий
в JSON параметр конструктора не вызывает исключение, а молча получает
значение по умолчанию (`null`/`0`). Если реальный фид поставщика присылает
обычные для JSON lowercase/camelCase ключи (`"sku"`, `"price"`, `"imageUrl"`),
а не точный PascalCase, — опции сериализации не настроены, значит поля не
свяжутся.
**Чем кончится:** при несовпадении регистра имён полей в реальном фиде
`SupplierItem.Sku` будет `null`, `Price` — `0`, `ImageUrl` — `null`, и это
не будет замечено — ни исключения, ни лога, молчаливо испорченные данные
каталога.
**Severity:** major.

### 6. PricesController.cs:23 — неэкранированный `sku` подставляется в путь исходящего HTTP-запроса
```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
```
`sku` — значение из маршрута (`[HttpPost("{sku}/notify")]`), ничем не
ограниченное по составу символов, и подставляется в относительный URI без
`Uri.EscapeDataString`/валидации. Значение с `/`, `..` или другими
спецсимволами меняет путь исходящего запроса, который сервер отправляет от
своего имени на сервис уведомлений.
**Чем кончится:** вызывающий endpoint `prices/{sku}/notify` может
подобранным `sku` заставить сервер отправить POST на произвольный путь
хоста "notifications" (path injection в исходящий запрос, которому,
вероятно, доверяет внутренняя сеть) — риск, аналогичный SSRF через
собственный backend.
**Severity:** major.

### 7. PricesController.cs:19-25 — `Notify` не имеет авторизации/валидации входа
Метод `Notify` публично доступен (`[HttpPost("{sku}/notify")]`, в этом файле
нет `[Authorize]` или иной проверки), принимает произвольный `sku` без
проверки его существования и безусловно вызывает исходящий запрос к сервису
уведомлений. В показанном коде нет никакой защиты от массового вызова.
**Чем кончится:** любой, кто может достучаться до `prices/{sku}/notify`,
может инициировать поток исходящих уведомлений на произвольные/несуществующие
sku — злоупотребление эндпоинтом как прокси для спама/флуда внутреннего
сервиса уведомлений либо подмена уведомлений о смене цены. (Если
авторизация реализована глобальным middleware/filter вне этого каталога —
находка снимается; в показанном коде такой защиты не видно.)
**Severity:** major.

## Minor

### 8. PricesController.cs:23-24 — результат исходящего запроса не проверяется
```csharp
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```
Код ответа `PostAsync` (`response.IsSuccessStatusCode`) не проверяется —
`Accepted()` возвращается независимо от того, принял ли сервис уведомлений
запрос. Также именованный клиент `"notifications"` используется с
относительным URI; если у него не настроен `BaseAddress` (конфигурация не
входит в состав показанных файлов), `PostAsync` бросит
`InvalidOperationException` ещё до какой-либо проверки ответа.
**Чем кончится:** вызывающая сторона и мониторинг считают уведомление
доставленным, даже если сервис уведомлений ответил ошибкой или клиент не
настроен — тихая потеря уведомлений о смене цены.
**Severity:** minor.

## Итог
- Blocker: 3
- Major: 4
- Minor: 1
