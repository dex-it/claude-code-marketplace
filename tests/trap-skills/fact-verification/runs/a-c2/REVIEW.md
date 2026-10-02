# Ревью MR: Pricing.Api

Описание MR: базовая цена от поставщика с кэшем, финальная цена со скидкой, кэш страниц каталога
с инвалидацией по событию, разбор JSON-фида поставщика, уведомление о смене цены.

Код не правился, только чтение.

## Blocker

### 1. src/SupplierFeedParser.cs:8-14 - regex-стрип комментариев ломает JSON на любом поле-URL

```
8:    // Поставщик кладёт в JSON-фид комментарии //. В System.Text.Json нет настройки,
9:    // которая позволяет пропускать комментарии, поэтому вырезаем их до разбора.
10:    private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
14:        var clean = LineComment.Replace(json, string.Empty);
```

Что не так: комментарий-обоснование фактически неверен - `System.Text.Json` умеет пропускать
комментарии нативно (`JsonSerializerOptions.ReadCommentHandling = JsonCommentHandling.Skip`,
поддерживает `//` и `/* */`, не трогая содержимое строк). Вместо штатного механизма код режет
текст регуляркой `//.*$` по всему сырому JSON, не отличая комментарий вне строки от `//` внутри
строкового значения. `SupplierItem.ImageUrl` документирован тем же файлом (строка 22) как
`https://cdn.supplier.example/img/123.png` - то есть гарантированно содержит `//`. Regex вырежет
всё от первого `//` в значении `ImageUrl` до конца строки (при однострочном фиде - до конца всего
документа), обрубив закрывающую кавычку/скобки.

Чем кончится: `JsonSerializer.Deserialize` либо бросает `JsonException` на каждом фиде с хотя бы
одним `https://`-полем (то есть на каждом реальном фиде), либо (при многострочном/pretty-printed
JSON) молча теряет часть полей/элементов. Разбор фида поставщика в текущем виде не работает
практически никогда.

Severity: blocker.

### 2. src/PriceService.cs:22 - целочисленное деление обнуляет скидку 1-99%

```
19:    public async Task<decimal> GetFinalPriceAsync(string sku, int discountPercent, CancellationToken ct)
20:    {
21:        var basePrice = await GetBasePriceAsync(sku, ct);
22:        var discounted = basePrice - basePrice * (discountPercent / 100);
23:        return Math.Round(discounted, 2);
```

Что не так: `discountPercent` и `100` - оба `int`, `discountPercent / 100` считается целочисленно
и округляется вниз до 0 для любого `discountPercent` из диапазона 1..99 (контроллер пропускает
именно 0..100 включительно, `PricesController.cs:14`). В итоге `discounted = basePrice - basePrice*0
= basePrice`.

Чем кончится: скидка применяется корректно только при `discountPercent == 0` (нет скидки) и
`discountPercent == 100` (цена 0). Любое реальное значение скидки (10%, 20%, 50%...) возвращает
полную цену без скидки - основная функция "финальная цена со скидкой" не работает.

Severity: blocker.

### 3. src/CatalogCache.cs:17 - вызов несуществующего метода `HybridCache.EvictByTagAsync`

```
15:    public async Task InvalidateAsync(CancellationToken ct)
16:    {
17:        await cache.EvictByTagAsync("catalog", ct);
18:    }
```

Что не так: у `HybridCache` (`Microsoft.Extensions.Caching.Hybrid`) метод инвалидации по тегу
называется `RemoveByTagAsync`. `EvictByTagAsync` - метод другого, похожего по духу API
(`IOutputCacheStore` из `Microsoft.AspNetCore.OutputCaching`), у `HybridCache` такого метода нет.

Чем кончится: `CS1061` - проект не компилируется. Единственный написанный путь инвалидации кэша
каталога нерабочий буквально на уровне сборки.

Severity: blocker.

### 4. src/PriceService.cs:7-17 - ложная гарантия "один вызов на ключ" у `IMemoryCache`, риск бана ключа поставщика

```
7:    // GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
8:    // параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
9:    public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
10:    {
11:        var price = await cache.GetOrCreateAsync($"price:{sku}", async entry =>
12:        {
13:            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
14:            return await supplier.GetPriceAsync(sku, ct);
15:        });
```

Что не так: расширение `CacheExtensions.GetOrCreateAsync` для `IMemoryCache` не имеет никакой
блокировки - это `TryGetValue` + при промахе безусловный вызов фабрики. В отличие от `HybridCache`
(у которого single-flight per key задокументирован явно), `IMemoryCache.GetOrCreateAsync` такой
гарантии не даёт: N параллельных запросов на холодный ключ - N параллельных вызовов
`supplier.GetPriceAsync`. Комментарий в коде описывает поведение `HybridCache`, а не
`IMemoryCache`, которым в этом файле фактически пользуются.

Чем кончится: `ISupplierClient` документирован (`Contracts.cs:5`) лимитом 5 запросов/сек на ключ
с баном ключа на час при превышении. Всплеск параллельных запросов на популярный/только
инвалидированный SKU (или просто холодный старт) даёт cache stampede на этот единственный вызов
к поставщику - прямой путь к превышению лимита и часовому бану ключа, то есть к отказу всего
сервиса цен на час.

Severity: blocker.

## Major

### 5. src/PricesController.cs:20-24 - `Notify` не проверяет исход отправки, всегда отвечает 202

```
19:    [HttpPost("{sku}/notify")]
20:    public async Task<IActionResult> Notify(string sku, CancellationToken ct)
21:    {
22:        var client = httpFactory.CreateClient("notifications");
23:        await client.PostAsync($"/price-changed/{sku}", null, ct);
24:        return Accepted();
25:    }
```

Что не так: `HttpClient.PostAsync` не бросает исключение на неуспешный статус-код (4xx/5xx) -
исключение возможно только при сетевой ошибке. Код не проверяет `response.IsSuccessStatusCode` и
не вызывает `EnsureSuccessStatusCode()`.

Чем кончится: если сервис уведомлений вернёт 4xx/5xx (например, SKU не найден на его стороне,
внутренняя ошибка), `Notify` всё равно отвечает вызывающему `202 Accepted`. Потребитель API
получает ложный сигнал "уведомление доставлено", реальный провал уведомления о смене цены
никак не наблюдаем ни в ответе, ни (судя по коду) в логах.

Severity: major.

### 6. src/CatalogCache.cs:5-19 - класс не вызывается ни из одного места в поставленном коде

Что не так: во всём каталоге MR (`src/*.cs`) нет ни одного вызова `CatalogCache.GetPageAsync` или
`CatalogCache.InvalidateAsync` - ни контроллера, отдающего страницы каталога, ни обработчика
события "каталог обновлён" (на который ссылается комментарий на строке 14). Сам класс
существует изолированно.

Чем кончится: даже после исправления находки №3, фича "кэш страниц каталога с инвалидацией по
событию" из описания MR ничем не достижима в runtime - нет HTTP-поверхности, читающей страницы
каталога через кэш, и нет подписчика на событие, вызывающего инвалидацию. Код мёртв как есть.

Severity: major.

## Minor

### 7. src/PricesController.cs:22-23 - уведомление о смене цены не несёт данных о цене

```
23:        await client.PostAsync($"/price-changed/{sku}", null, ct);
```

Что не так: тело запроса - `null`. В уведомлении передаётся только SKU, без нового значения цены
(и без старого, для сравнения).

Чем кончится: получатель уведомления не может узнать, какая цена стала актуальной, не делая
обратный вызов в Pricing.Api за текущей ценой - notify-and-pull вместо push, что может быть
осознанным решением, но нигде не оговорено и не очевидно из кода.

Severity: minor.

### 8. src/PricesController.cs:11-16 - исключения из `GetFinalPriceAsync` не транслируются в осмысленный статус

```
11:    [HttpGet("{sku}")]
12:    public async Task<ActionResult<decimal>> Get(string sku, [FromQuery] int discount, CancellationToken ct)
13:    {
14:        if (discount is < 0 or > 100) return BadRequest();
15:        return await prices.GetFinalPriceAsync(sku, discount, ct);
16:    }
```

Что не так: если `supplier.GetPriceAsync` бросает исключение (таймаут, бан ключа по лимиту, см.
находку №4, неизвестный SKU и т.п.), оно долетает до `Get` необработанным.

Чем кончится: клиент API получает generic 500 без различения "поставщик недоступен" (ожидаемо
503/502) от "внутренняя ошибка сервиса" - хуже диагностируется на стороне вызывающего сервиса,
в проде плюс риск утечки деталей исключения в ответ в зависимости от конфигурации error-хендлинга
(которая не входит в этот MR).

Severity: minor.

## Итог по severity

- Blocker: 4
- Major: 2
- Minor: 2
