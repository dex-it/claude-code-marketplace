# Ревью MR: Pricing.Api

Описание MR: базовая цена от поставщика с кэшем, финальная цена со скидкой, кэш страниц
каталога с инвалидацией по событию, разбор JSON-фида поставщика, уведомление о смене цены.

Весь каталог - новый код, ревью read-only (код не правился).

## Находки

### 1. src/SupplierFeedParser.cs:10,14 - регекс комментариев режет URL с `//` в значении

```
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```

`SupplierItem.ImageUrl` по собственному doc-комментарию record'а (строки 22-23) имеет вид
`https://cdn.supplier.example/img/123.png` - содержит `//`. Регекс `//.*$` (Multiline, `.` без
`Singleline` не матчит `\n`) вырезает от первого `//` до конца строки: в pretty-printed JSON
строка `"imageUrl": "https://..."` превращается в `"imageUrl": "https:` - незакрытая строка,
синтаксически невалидный JSON; в компактном (однострочном) JSON обрезается весь остаток
документа после первого встреченного URL. `JsonSerializer.Deserialize` на таком входе бросает
`JsonException` (не возвращает null, так что `?? throw ...` на строке 16 до этого случая не
доходит).

Чем кончится: разбор фида поставщика падает с исключением на любом фиде, где хотя бы один item
несёт `ImageUrl` - то есть всегда, поле обязательное и всегда `https://...`. Заявленная в MR
функция «разбор JSON-фида поставщика» неработоспособна.

Severity: **blocker**

### 2. src/CatalogCache.cs:17 - вызов несуществующего метода `EvictByTagAsync`

```
await cache.EvictByTagAsync("catalog", ct);
```

У `HybridCache` (Microsoft.Extensions.Caching.Hybrid, пакет из .csproj v9.3.0) такого метода нет;
метод инвалидации по тегу называется `RemoveByTagAsync` (сверено: Microsoft Learn -
`HybridCache.RemoveByTagAsync` Method; `EvictByTagAsync` в API отсутствует).

Чем кончится: код не компилируется. Заявленная функция «инвалидация по событию» полностью
неработоспособна, сборка проекта ломается целиком (валит и все прочие фичи в этом же MR).

Severity: **blocker**

### 3. src/PriceService.cs:7-15 - `IMemoryCache.GetOrCreateAsync` не даёт single-flight, комментарий утверждает противоположное

```
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
    return price;
}
```

Сверено: `IMemoryCache.GetOrCreateAsync` (Microsoft.Extensions.Caching.Memory) делает
check-then-create не атомарно - при промахе/протухании несколько параллельных вызовов на один
ключ могут одновременно выполнить фабрику (dotnet/runtime issues #36499 "GetOrCreate is not
atomic", #71581 "CacheExtensions.GetOrCreate{Async} thread-safety"; блог tpodolak.com напрямую
воспроизводит этот кейс). Single-flight/stampede-защиту даёт именно `HybridCache` (которым в
этом же MR пользуется `CatalogCache`), а не `IMemoryCache` - комментарий переносит гарантию
одного API на другой, где её нет.

Чем кончится: раз в 5 минут (TTL записи, строка 13) при протухании кэша всплеск параллельных
запросов на популярный sku бьёт в `ISupplierClient.GetPriceAsync` несколько раз одновременно. По
`Contracts.cs:5` у поставщика лимит 5 запросов/сек на ключ, превышение - бан ключа на час: путь к
часовому отказу всей выдачи цен (не только по одному sku - ключ поставщика общий), и это не
гипотетический edge case, а прямое следствие штатной работы под нагрузкой.

Severity: **blocker**

### 4. src/PriceService.cs:22 - целочисленное деление гасит скидку

```
var discounted = basePrice - basePrice * (discountPercent / 100);
```

`discountPercent` - `int`, `100` - `int`-литерал: `discountPercent / 100` - целочисленное деление,
даёт `0` для любого `discountPercent` в диапазоне 1..99 (и `1` только при 100). В результате
`discounted == basePrice` для любой скидки 1-99% (скидка не применяется вовсе), а при
`discountPercent == 100` цена становится `0` вместо ожидаемого поведения на границе.

Чем кончится: заявленная функция «финальная цена со скидкой» не работает практически для всех
входных значений скидки - клиент всегда получает базовую цену.

Severity: **blocker**

### 5. src/PricesController.cs:22-23 - sku подставляется в исходящий путь без экранирования

```
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
```

`sku` приходит из маршрута без валидации формата и без `Uri.EscapeDataString`/аналога. Если sku
содержит `/`, `..` или иные значимые для URL символы, итоговый относительный путь запроса к
хосту клиента "notifications" меняется произвольно - вызывающий может дотянуться до другого пути
на этом хосте, а не только до `/price-changed/{sku}`.

Чем кончится: path injection в исходящий HTTP-вызов, управляемый непроверенным клиентским входом.

Severity: **major**

### 6. src/PricesController.cs:22-25 - результат уведомления не проверяется

```
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```

Статус ответа `PostAsync` не читается (`EnsureSuccessStatusCode` или явная проверка `IsSuccessStatusCode`
отсутствуют); эндпойнт возвращает `202 Accepted` независимо от того, принял ли сервис нотификаций
запрос.

Чем кончится: неудачное уведомление о смене цены (4xx/5xx у сервиса нотификаций) молча теряется -
ни вызывающий, ни логи не узнают, что уведомление не доехало.

Severity: **major**

### 7. src/PricesController.cs (Notify) + весь src/ - «уведомление о смене цены» не привязано к обнаружению смены цены

Эндпойнт `POST /prices/{sku}/notify` (строки 19-25) - произвольно вызываемый триггер: ничто в
предоставленном коде не сравнивает старую и новую цену и не решает, что цена действительно
изменилась, перед вызовом уведомления. `SupplierFeedParser` разбирает цены из фида, но результат
разбора никуда не передаётся в `PriceService`/кэш и не порождает вызов `Notify`. Единственный
имеющийся путь к уведомлению - ручной POST от произвольного вызывающего на произвольный sku.

Чем кончится: если это единственная точка входа для функции «уведомление о смене цены» из
описания MR, реального обнаружения смены цены нет - уведомления либо не отправляются
автоматически вовсе, либо отправляются ложно (для sku без изменения цены) по решению вызывающего.

Severity: **major**

### 8. src/PriceService.cs:23 - округление банковским методом без явного решения

```
return Math.Round(discounted, 2);
```

Сверено: `Math.Round`/`Decimal.Round` без явного `MidpointRounding` округляет по `ToEven`
("банковское" округление, стандарт IEEE 754 §4) - `2.005` округлится к `2.00`, а не к `2.01`.
Для денежных сумм коммерчески обычно ожидается `AwayFromZero`; здесь режим выбран неявно
(дефолтом), явного бизнес-решения в коде или комментарии нет.

Чем кончится: на скидках, дающих полтора цента, итоговая цена на копейку отличается от
интуитивно ожидаемой - при отсутствии явно зафиксированного правила округления это либо
осознанный выбор без следа, либо недосмотр.

Severity: **minor**

### 9. src/PricesController.cs:12,14 - `discount` не обязателен, отсутствие параметра трактуется как 0%

```
public async Task<ActionResult<decimal>> Get(string sku, [FromQuery] int discount, CancellationToken ct)
{
    if (discount is < 0 or > 100) return BadRequest();
```

`discount` объявлен как `int` без `[Required]`/`[BindRequired]` и без `?`. При отсутствии query-параметра
model binding подставит `default(int) == 0` без ошибки валидации - `GET /prices/{sku}` без
`discount` тихо трактуется как «скидка 0%», а не как невалидный запрос.

Чем кончится: если по контракту клиент обязан передавать скидку явно, пропуск параметра проходит
незамеченным как валидный запрос с нулевой скидкой - молчаливая деградация, а не 400.

Severity: **minor**

## Итог по severity

- blocker: 4
- major: 3
- minor: 2

Всего находок: 9.
