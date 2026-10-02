# Review: Pricing.Api - цены, кэш каталога, фид поставщика, уведомления

Ревью всего каталога (MR = новый код). Факты о поведении библиотек сверены с официальной
документацией Microsoft Learn (HybridCache для net9.0/пакет 9.3.0) и issue dotnet/runtime,
дисциплина - `fact-verification`.

## Находки

### 1. src/CatalogCache.cs:17 - вызов несуществующего метода `EvictByTagAsync` на `HybridCache`

```csharp
await cache.EvictByTagAsync("catalog", ct);
```

`cache` типизирован как `Microsoft.Extensions.Caching.Hybrid.HybridCache` (пакет
`Microsoft.Extensions.Caching.Hybrid` 9.3.0, см. `Pricing.Api.csproj:7`). У этого класса метода
`EvictByTagAsync` нет - сверено по официальному API reference
(learn.microsoft.com/.../hybridcache, полный список членов класса: `GetOrCreateAsync` overloads,
`RemoveAsync`, `RemoveByTagAsync`, `SetAsync`). Нужный метод называется `RemoveByTagAsync(string,
CancellationToken)`. `EvictByTagAsync` - метод другого, несвязанного типа,
`Microsoft.AspNetCore.OutputCaching.IOutputCacheStore` (output caching, не HybridCache) - имена
спутаны.

**Чем кончится**: код не компилируется (CS1061 - 'HybridCache' does not contain a definition for
'EvictByTagAsync'). Вся заявленная в MR функция "кэш страниц каталога с инвалидацией по событию"
неработоспособна уже на уровне сборки.

**Severity**: blocker

---

### 2. src/PriceService.cs:22 - целочисленное деление ломает расчёт скидки

```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```

`discountPercent` - `int`, `100` - целочисленный литерал, `discountPercent / 100` - целочисленное
деление. Для `discountPercent` от 1 до 99 (весь практически используемый диапазон скидки)
результат деления - 0, и `discounted` равен `basePrice` без изменений. При `discountPercent == 100`
результат деления - 1, и цена превращается в 0. Корректный результат получается только на границах
0 и 100 случайно, не по замыслу.

**Чем кончится**: `GetFinalPriceAsync` возвращает полную цену поставщика при любой скидке 1-99% -
скидка тихо не применяется никогда в реальном использовании (типичные значения 5, 10, 15, 20...%).
Ключевая заявленная функция MR ("финальная цена со скидкой") сломана.

**Severity**: blocker

---

### 3. src/SupplierFeedParser.cs:10,14 - regex-вырезание `//`-комментариев рвёт JSON с URL-полями

```csharp
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
return JsonSerializer.Deserialize<SupplierFeed>(clean) ?? ...
```

Regex вырезает всё от первого `//` до конца строки, не различая, находится ли `//` внутри
JSON-комментария или внутри строкового значения. `SupplierItem.ImageUrl` (там же, строка 22-23)
документирован как абсолютный адрес вида `https://cdn.supplier.example/img/123.png` - то есть
каждый элемент фида содержит `//` внутри строки. На такой строке regex срежет `//cdn.supplier...`
до конца строки (включая закрывающую кавычку и запятую), оставив незакрытый строковый литерал.
Дальше это либо ловится `JsonException` при разборе (незакрытая строка/неэкранированный перевод
строки внутри значения запрещён RFC 8259 и STJ), либо кавычка "закрывается" следующим встречным
`"` из соседнего JSON-токена, и в значение попадает мусор из соседних полей.

**Чем кончится**: разбор фида падает или отдаёт повреждённые данные на каждом элементе с
`ImageUrl` - то есть практически на любом реальном фиде поставщика, а не в редком краевом случае.
Заявленная функция "разбор JSON-фида поставщика" не работает на данных, соответствующих
собственной же модели `SupplierItem`.

**Severity**: blocker

---

### 4. src/PriceService.cs:7-8 (комментарий) - ложное утверждение о поведении `IMemoryCache.GetOrCreateAsync`, усиливает риск бана ключа у поставщика

```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```

Здесь используется `IMemoryCache` (`Microsoft.Extensions.Caching.Memory`, см. `using` в строке 1),
а не `HybridCache`. Расширение `CacheExtensions.GetOrCreateAsync` для `IMemoryCache` не
синхронизирует конкурентные вызовы: при параллельном промахе по одному и тому же ключу фабрика
вызывается независимо у каждого вызывающего (подтверждено issue dotnet/runtime #71581 -
"CacheExtensions.GetOrCreate{Async} thread-safety"; single-flight/stampede-защита - это
документированное свойство именно `HybridCache.GetOrCreateAsync`, а не `IMemoryCache`). Комментарий
приписывает `IMemoryCache` гарантию другого типа.

`ISupplierClient.GetPriceAsync` (см. `src/Contracts.cs:5`) документирован жёстким лимитом
поставщика: "не больше 5 запросов в секунду на ключ; превышение - бан ключа на час". В коде нет
никакого throttling/rate-limiting вызовов `supplier.GetPriceAsync` ни глобально, ни по SKU - расчёт
именно на несуществующую защиту от дублирующих вызовов через кэш.

**Чем кончится**: под параллельной нагрузкой (первый запрос по новому SKU, либо множество
запросов сразу после истечения 5-минутного TTL записи) на один и тот же SKU одновременно уйдёт
несколько запросов к поставщику; при интенсивной нагрузке по многим SKU легко превысить лимит 5
RPS. Итог по контракту поставщика - бан ключа на час, то есть полный отказ фичи "базовая цена от
поставщика" на этот срок.

**Severity**: major

---

### 5. src/PricesController.cs:22-23 - результат уведомления не проверяется, ошибка теряется молча

```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```

`HttpResponseMessage`, возвращённый `PostAsync`, не сохраняется и не проверяется (нет
`EnsureSuccessStatusCode()`/проверки `IsSuccessStatusCode`, нет логирования при неуспехе). Эндпоинт
всегда отвечает `202 Accepted`, независимо от того, принял ли получатель уведомление, вернул ли
4xx/5xx, или запрос вовсе не дошёл (сеть/DNS - в этом случае `PostAsync` бросит исключение, но при
любом HTTP-статусе ошибки исключения не будет, `PostAsync` не бросает на 4xx/5xx).

**Чем кончится**: неуспешная доставка уведомления о смене цены проходит незамеченной - вызывающая
сторона получает `202` и считает уведомление отправленным, хотя оно могло не долететь; ни повтора,
ни алерта, ни следа в логах нет. Заявленная функция "уведомление о смене цены" ненадёжна без
какой-либо видимости этого факта.

**Severity**: major

---

### 6. src/SupplierFeedParser.cs:23 / Contracts.cs - данные внешнего фида не валидируются перед использованием как цена

`SupplierItem.Price` (decimal) и `Sku` (string) принимаются из фида поставщика и используются
дальше как цена без какой-либо проверки (нет проверки на отрицательное/нулевое значение `Price`,
на пустой `Sku`). Источник - внешняя система (см. комментарий про её же лимиты в `Contracts.cs:5`),
доверия к формату которой в остальном коде явно нет ("поставщик кладёт в JSON-фид комментарии //" -
уже сигнал, что фид неидеален).

**Чем кончится**: повреждённая или аномальная запись у поставщика (`Price: -5` или `Price: 0`)
пройдёт в каталог/цены без какой-либо задержки или алерта.

**Severity**: minor

## Итог

- blocker: 3
- major: 2
- minor: 1
