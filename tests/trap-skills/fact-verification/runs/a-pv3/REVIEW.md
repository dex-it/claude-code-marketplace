# Review: Pricing.Api (PR312)

Проверка фактов о поведении библиотек выполнена по дисциплине `fact-verification`
(context7 `/websites/deepwiki_dotnet_extensions`, learn.microsoft.com для `System.Text.Json`).
Источники приведены при каждой находке, где комментарий в коде утверждает факт о библиотеке.

## Blocker

### 1. src/PriceService.cs:22 — скидка не применяется (целочисленное деление)

```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```

`discountPercent` — `int`. `discountPercent / 100` — целочисленное деление: для любого
значения 1..99 результат равен `0`. Скидка применяется только на границах: `discount=0`
(0/100=0, скидки и не должно быть — совпадение) и `discount=100` (100/100=1, цена становится 0).
Для всех остальных процентов из диапазона, разрешённого валидацией в контроллере
(`PricesController.cs:14`, `0..100`), скидка просто не вычитается — клиент получает полную
базовую цену.

Чем кончится: ключевая фича MR («финальная цена со скидкой») не работает почти для всех
входных значений; баг не бросает исключение и не виден в логах — тихо отдаёт неверную цену.

Severity: **blocker**.

### 2. src/PriceService.cs:7-8, 11 — неверный факт о `GetOrCreateAsync`, гонка на поставщика

```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```

Это `IMemoryCache` (`Microsoft.Extensions.Caching.Memory`), а не `HybridCache`. Проверено
через context7 (`/websites/deepwiki_dotnet_extensions`, раздел Hybrid Caching /
`StampedeState`): защита от «стада» (single-flight — фабрика вызывается один раз на ключ
при параллельных запросах) — это отдельная, именованная фича именно `HybridCache`
(`StampedeState`/«stampede protection»), которую авторы `Microsoft.Extensions` ввели
отдельным пакетом именно потому, что у обычного `IMemoryCache.GetOrCreateAsync` такой
гарантии нет: при параллельном промахе кэша каждый вызывающий может выполнить фабрику
самостоятельно. Комментарий в коде утверждает обратное и используется как обоснование
отказа от блокировки.

Чем кончится: при одновременных запросах на ещё не закэшированный/истёкший `sku`
(кэш живёт 5 минут, `PriceService.cs:13`) `supplier.GetPriceAsync` может быть вызван
параллельно несколько раз на один `sku`. Согласно контракту поставщика
(`Contracts.cs:5`: «не больше 5 запросов в секунду на ключ; превышение — бан ключа на час»),
всплеск параллельных запросов (прогрев кэша, деплой, скачок трафика на популярный sku)
может посадить API-ключ в бан на час для всего сервиса.

Severity: **blocker**.

## Blocker (продолжение)

### 3. src/SupplierFeedParser.cs:8-10 (обоснование), 14 (эффект) — regex вместо штатной опции, порча фида

```csharp
// Поставщик кладёт в JSON-фид комментарии //. В System.Text.Json нет настройки,
// которая позволяет пропускать комментарии, поэтому вырезаем их до разбора.
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```

Факт в комментарии неверен: проверено на learn.microsoft.com
(`JsonSerializerOptions.ReadCommentHandling`, применимо и к net-9.0 — целевой фреймворк
проекта) — в System.Text.Json есть штатная настройка `JsonSerializerOptions.ReadCommentHandling
= JsonCommentHandling.Skip`, которая пропускает `//`-комментарии на уровне токенайзера,
не трогая содержимое строк.

Вместо неё написан построчный regex `//.*$`, который вырезает «комментарий» по первому
совпадению `//` в строке — включая `//` внутри обычных JSON-значений. Контракт
`SupplierItem.ImageUrl` (`SupplierFeedParser.cs:22`) описан как абсолютный URL вида
`https://cdn.supplier.example/img/123.png` — то есть содержит `//` сразу после `https:`.
Для любой строки фида с таким значением regex вырежет всё от `//` до конца строки
(а в компактном однострочном JSON без переводов строк — вообще до конца всего документа),
оставив, например, `"ImageUrl": "https:` — незакрытую строку.

Чем кончится: `JsonSerializer.Deserialize` бросает `JsonException` (или возвращает `null`,
что уже обрабатывается как `InvalidOperationException` на строке 16) на практически любом
элементе фида с `ImageUrl` — то есть разбор фида поставщика закономерно ломается в
штатном случае, а не в каком-то крайнем.

Severity: **blocker**.

## Major

### 4. src/SupplierFeedParser.cs:15 — разбор JSON без учёта регистра имён свойств

```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```

Вызов использует `JsonSerializerOptions` по умолчанию. Проверено на learn.microsoft.com
(`JsonSerializerOptions.PropertyNameCaseInsensitive`, применимо к net-9.0): «The default
value is `false`» — то есть по умолчанию сопоставление имён свойств регистро-зависимое.
Записи `SupplierFeed`/`SupplierItem` (`Contracts.cs`-стиль, тут в `SupplierFeedParser.cs:20-23`)
объявлены в PascalCase (`Sku`, `Price`, `ImageUrl`) и не несут `[JsonPropertyName]`. Внешние
JSON-фиды от поставщиков в типичном случае отдают `camelCase` (`sku`, `price`, `imageUrl`)
или `snake_case`.

Чем кончится: если реальный регистр полей фида поставщика не совпадает побуквенно с именами
записи, `Deserialize` не бросает исключение — непонятые поля тихо получают значения по
умолчанию (`Sku = null`, `Price = 0`, `ImageUrl = null`), и дальше по пайплайну разойдутся
позиции с нулевой ценой/пустым SKU без единого сигнала об ошибке. Это нужно либо
подтвердить примером реального фида (сейчас в репозитории его нет — факт о регистре полей
конкретного поставщика непроверяем в рамках этого MR, статус `unverifiable`), либо закрыть
`PropertyNameCaseInsensitive = true` / `JsonPropertyName`, чтобы не зависеть от угадывания.

Severity: **major**.

## Minor

### 5. src/PricesController.cs:23 — sku не экранируется при построении URL уведомления

```csharp
await client.PostAsync($"/price-changed/{sku}", null, ct);
```

`sku` приходит из маршрута (`{sku}` на строке 20) и подставляется в путь исходящего запроса
без `Uri.EscapeDataString`/аналогичного экранирования. Если `sku` после декодирования
маршрута содержит `/`, `?`, `#` или пробелы, итоговый путь может указать на другой ресурс
на том же хосте уведомлений, чем ожидалось (например, добавить лишний сегмент пути или
query-параметр).

Severity: **minor**.

### 6. src/PricesController.cs:23 — результат уведомления не проверяется

```csharp
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```

Код не проверяет `HttpResponseMessage.IsSuccessStatusCode` и не логирует неудачу. Если
сервис уведомлений ответит 4xx/5xx или упадёт по таймауту (а `HttpClient.PostAsync` сам по
себе не бросает исключение на код ответа, только на сетевые ошибки), эндпоинт всё равно
вернёт клиенту `202 Accepted`, как будто уведомление доставлено.

Чем кончится: потеря уведомлений об изменении цены проходит незаметно — ни ошибки у
вызывающего, ни записи в логах для последующего расследования.

Severity: **minor**.

### 7. src/CatalogCache.cs:9-12 — один общий тег на все страницы каталога

```csharp
cache.GetOrCreateAsync(
    $"catalog:page:{page}",
    async token => await repo.LoadPageAsync(page, token),
    tags: ["catalog"],
    cancellationToken: ct);
```

Все страницы каталога помечены одним и тем же тегом `"catalog"`. `InvalidateAsync`
(строки 15-18) вызывается из обработчика любого события «каталог обновлён» и сбрасывает
сразу весь кэш каталога целиком, а не только затронутые страницы.

Чем кончится: не функциональная ошибка (инвалидация корректна и не теряет данные), но при
частых событиях обновления каталога каждое из них вызывает полный перегрев — все страницы
перечитываются из `ICatalogRepository` заново, даже если изменилась одна позиция на одной
странице. При высокой частоте событий это создаёт нагрузочный всплеск на репозиторий
каталога, которого не было бы при тегировании по конкретной странице/sku.

Severity: **minor**.

---

## Итог по severity

- Blocker: 3
- Major: 1
- Minor: 3

Всего находок: 7.
