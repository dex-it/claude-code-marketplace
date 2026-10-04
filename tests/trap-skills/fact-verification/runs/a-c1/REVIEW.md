# Ревью MR: Цены, кэш каталога, фид поставщика, уведомление о смене цены

## Blocker

### 1. src/PriceService.cs:22 - скидка не применяется (целочисленное деление)
```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```
`discountPercent` и `100` - `int`, поэтому `discountPercent / 100` считается целочисленно и
равно `0` для любого значения `1..99` и `1` только при `discountPercent == 100`. В итоге
скидка реально работает только как «0% или 100%»: для 1..99% клиент получает полную базовую
цену без скидки, а при 100% - цену `0`. Это ключевая фича MR («финальная цена со скидкой»),
и она не работает ни для одного промежуточного значения. Нужно `discountPercent / 100m`
(decimal-деление) или `(decimal)discountPercent / 100`.
Severity: blocker.

### 2. src/SupplierFeedParser.cs:10,14 - regex вырезания комментариев ломает JSON на полях с `//`
```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```
Regex режет от первого `//` до конца строки без учёта того, находится ли `//` внутри JSON-строки.
Собственный комментарий того же файла (SupplierFeedParser.cs:22) документирует поле
`ImageUrl` как `https://cdn.supplier.example/img/123.png` - то есть само поле, которое парсер
обязан разобрать, содержит `//`. Строка вида `"imageUrl": "https://cdn.supplier.example/img/123.png",`
после `Replace` превращается в `"imageUrl": "https:` - незакрытая строка. Это либо валит
`JsonSerializer.Deserialize` исключением (`JsonException`) на первом же элементе с `ImageUrl`,
либо (для похожих на URL полей ближе к концу строки) молча обрубает значение. Разбор фида
поставщика - ядро фичи MR - не работает на собственном документированном формате данных.
Severity: blocker.

### 3. src/PriceService.cs:7-8,11 (+ src/Contracts.cs:5) - `IMemoryCache.GetOrCreateAsync` не даёт single-flight, вопреки комментарию
```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```
Утверждение в комментарии не соответствует поведению `Microsoft.Extensions.Caching.Memory`:
extension-метод `IMemoryCache.GetOrCreateAsync` не блокирует параллельные вызовы на промахе -
он просто делает `TryGetValue`, и при промахе каждый параллельный вызов независимо выполняет
фабрику (никакой синхронизации/дедупликации по ключу нет; это отличается от `HybridCache`,
который такую защиту от stampede действительно даёт и корректно используется рядом в
`src/CatalogCache.cs`). При параллельных запросах на один и тот же `sku` в момент промаха кэша
это означает несколько одновременных вызовов `ISupplierClient.GetPriceAsync` для одного SKU.
Согласно `src/Contracts.cs:5`, у поставщика лимит 5 запросов/сек на ключ и бан ключа на час при
превышении - то есть всплеск параллельных запросов на популярный SKU (типичный сценарий кэш-промаха
после протухания TTL под нагрузкой) может забанить ключ интеграции на час для всего сервиса.
Severity: blocker.

## Major

### 4. src/CatalogCache.cs:14-18 - `InvalidateAsync` никем не вызывается, инвалидации «по событию» в MR нет
```csharp
// Вызывается из обработчика события "каталог обновлён".
public async Task InvalidateAsync(CancellationToken ct)
{
    await cache.EvictByTagAsync("catalog", ct);
}
```
В каталоге MR (все 5 файлов) нет ни одного обработчика события, ни одного места, откуда
вызывается `InvalidateAsync` (проверено `grep -rn InvalidateAsync .` - единственное
совпадение - объявление метода). Описание MR обещает «кэш страниц каталога с инвалидацией по
событию», но само событие и подписка на него в этом MR не реализованы - метод мёртвый код,
инвалидация каталога по факту не происходит.
Severity: major.

### 5. src/PriceService.cs (весь файл) + src/PricesController.cs:19-25 - уведомление о смене цены не инвалидирует кэш базовой цены
`PriceService` не предоставляет метода инвалидации записи `price:{sku}`, а
`PricesController.Notify` (единственное место, где сервис узнаёт о смене цены) только шлёт
POST во внешний сервис нотификаций и не трогает `IMemoryCache` из `PriceService`. После смены
цены у поставщика и вызова `/prices/{sku}/notify` эндпоинт `GET /prices/{sku}` продолжит отдавать
старую цену ещё до 5 минут (TTL в PriceService.cs:13) - ровно то, что уведомление должно
было бы предотвратить.
Severity: major.

### 6. src/SupplierFeedParser.cs:15 - десериализация чувствительна к регистру имён свойств
```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```
Вызов без `JsonSerializerOptions` и без `[JsonPropertyName]` на `SupplierItem`/`SupplierFeed`.
`JsonSerializerOptions.PropertyNameCaseInsensitive` по умолчанию `false`, значит сопоставление
имён свойств `Items`/`Sku`/`Price`/`ImageUrl` (PascalCase в C#) с ключами JSON-фида идёт
регистро-зависимо. Если фид поставщика (внешняя система, обычная JSON-конвенция) отдаёт ключи
в camelCase (`items`/`sku`/`price`/`imageUrl`) или snake_case, свойства просто не найдут
соответствия и останутся со значением по умолчанию (`null`/`0`) - без исключения, то есть
тихая потеря данных (цена `0`, sku `null`) вместо явной ошибки разбора.
Severity: major (зависит от фактической схемы фида поставщика, которая не входит в этот MR).

### 7. src/PricesController.cs:23 - статус ответа нотификации не проверяется, ошибка глушится
```csharp
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```
`HttpClient.PostAsync` не бросает исключение на HTTP-ошибку (4xx/5xx) - бросает только на
сетевые сбои. Код не читает `response.IsSuccessStatusCode`/`EnsureSuccessStatusCode()` и всегда
возвращает `202 Accepted`, даже если сервис нотификаций ответил ошибкой. Вызывающая сторона
получает ложно-позитивный ответ «принято», хотя уведомление о смене цены не доставлено, и
это никак не логируется/не отражается наружу.
Severity: major.

## Minor

### 8. src/PricesController.cs:23 - `sku` подставляется в путь без URL-кодирования
```csharp
await client.PostAsync($"/price-changed/{sku}", null, ct);
```
`sku` приходит из маршрута уже декодированным ASP.NET Core. Если значение содержит `/`, `..`
или другие спецсимволы (например, закодированные в исходном запросе как `%2F`, `%2E%2E%2F`),
они попадут в путь буквально и при объединении с `BaseAddress` именованного клиента
`"notifications"` могут сместить целевой путь запроса на другой эндпоинт того же хоста.
Нужно `Uri.EscapeDataString(sku)`.
Severity: minor.

### 9. src/PricesController.cs:23 - уведомление не несёт данных о смене цены
`POST .../price-changed/{sku}` отправляется с пустым телом (`null`). Кроме SKU (уже в пути)
получатель не узнаёт ни старую, ни новую цену и должен сам идти за ней в источник - если это
не заложено в контракте получателя намеренно, уведомление менее полезно, чем предполагает
описание фичи «уведомление о смене цены».
Severity: minor.

## Итог
- Blocker: 3
- Major: 4
- Minor: 2
- Всего находок: 9
