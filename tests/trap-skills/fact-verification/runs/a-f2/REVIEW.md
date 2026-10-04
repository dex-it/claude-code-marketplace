# Review: Pricing.Api

Дисциплина: `dex-skill-fact-verification`. Факты об API/дефолтах сверены с официальной
документацией через WebSearch (context7 недоступен - "Monthly quota exceeded"); ссылки на
источник даны при каждой находке, где сверка проводилась.

## Находки

### 1. src/CatalogCache.cs:17 - несуществующий метод `EvictByTagAsync`

```
await cache.EvictByTagAsync("catalog", ct);
```

У `Microsoft.Extensions.Caching.Hybrid.HybridCache` нет метода `EvictByTagAsync`. Метод
инвалидации по тегу называется `RemoveByTagAsync` (подтверждено Microsoft Learn:
`HybridCache.RemoveByTagAsync Method (Microsoft.Extensions.Caching.Hybrid)`,
learn.microsoft.com/.../hybridcache.removebytagasync).

**Чем кончится**: проект не компилируется (`CS1061`), заявленная в описании MR фича «кэш
страниц каталога с инвалидацией по событию» не работает вообще - метод, который должен её
инвалидировать, не существует.

**Severity**: blocker.

### 2. src/PriceService.cs:22 - целочисленное деление в расчёте скидки

```csharp
var discounted = basePrice - basePrice * (discountPercent / 100);
```

`discountPercent` - `int`, `100` - литерал `int`, `discountPercent / 100` - целочисленное
деление. Для любого `discountPercent` из диапазона 1..99 результат деления - `0`, то есть
`basePrice * 0 = 0`, и `discounted == basePrice` (скидка не применяется вообще). Для
`discountPercent == 100` результат деления - `1`, `discounted == 0` (100% скидка - случайно
верно). Для `discountPercent == 0` тоже случайно верно (`0/100 == 0`).

**Чем кончится**: «финальная цена со скидкой» - основная заявленная фича MR - не работает для
всего диапазона скидок кроме двух граничных значений: клиенту всегда возвращается полная цена
поставщика вместо цены со скидкой.

**Severity**: blocker.

### 3. src/PriceService.cs:7-9 (комментарий) и 11-15 - ложное утверждение о single-flight у `IMemoryCache.GetOrCreateAsync`

```csharp
// GetOrCreateAsync гарантирует, что фабрика вызовется один раз на ключ даже при
// параллельных запросах, поэтому отдельная блокировка вокруг поставщика не нужна.
public async Task<decimal> GetBasePriceAsync(string sku, CancellationToken ct)
{
    var price = await cache.GetOrCreateAsync($"price:{sku}", async entry => { ... });
```

Утверждение неверно: `Microsoft.Extensions.Caching.Memory.IMemoryCache.GetOrCreateAsync` (в
отличие от `HybridCache.GetOrCreateAsync`, которая действительно даёт stampede-protection) не
синхронизирует конкурентный доступ - при одновременном промахе кэша (истечение TTL в 5 минут,
холодный старт, несколько реплик) фабрика вызывается параллельно на каждый конкурентный запрос.

**Чем кончится**: при одновременных запросах на один `sku` в момент истечения записи кэша
`supplier.GetPriceAsync` вызывается несколько раз параллельно вместо одного - при достаточной
конкуррентности это превышает документированный в `Contracts.cs:5` лимит поставщика «не больше 5
запросов в секунду на ключ», что банит ключ на час и валит весь ценовой функционал.

**Severity**: major (зависит от конкуррентности в момент экспирации записи, но последствие -
часовой бан ключа - тяжёлое).

### 4. src/SupplierFeedParser.cs:8-10, 14 - regex вырезает `//` внутри строковых значений JSON, а не только комментарии

```csharp
// Поставщик кладёт в JSON-фид комментарии //. В System.Text.Json нет настройки,
// которая позволяет пропускать комментарии, поэтому вырезаем их до разбора.
private static readonly Regex LineComment = new(@"//.*$", RegexOptions.Multiline | RegexOptions.Compiled);
...
var clean = LineComment.Replace(json, string.Empty);
```

Два независимых дефекта на одном месте:

- **Отрицательный факт неверен**: в `System.Text.Json` есть штатная настройка
  `JsonSerializerOptions.ReadCommentHandling = JsonCommentHandling.Skip`, которая пропускает `//`
  и `/* */` комментарии при разборе без какой-либо предобработки текста (подтверждено Microsoft
  Learn: `JsonSerializerOptions.ReadCommentHandling Property`). Самописный regex-обход не нужен.
- **Regex не разбирает JSON, а слепо режет по первому `//` в строке**: `@"//.*$"` с
  `RegexOptions.Multiline` вырезает всё от первого вхождения `//` до конца строки текста, включая
  `//`, встретившееся внутри JSON-строкового значения. `SupplierItem.ImageUrl` по контракту
  (`Contracts.cs:22`) - абсолютный URL вида `https://cdn.supplier.example/img/123.png`. Строка
  фида вида `"imageUrl": "https://cdn.supplier.example/img/123.png",` после `Replace`
  превращается в `"imageUrl": "https` - незакрытая строка, невалидный JSON.

**Чем кончится**: `JsonSerializer.Deserialize<SupplierFeed>` бросает `JsonException` на любом
элементе фида, где есть `ImageUrl` (а он обязателен для каждого `SupplierItem`) - то есть на
любом реальном фиде поставщика с картинками. Разбор JSON-фида поставщика - заявленная фича MR -
не работает на типичных данных, не только на редких edge-case.

**Severity**: blocker.

### 5. src/SupplierFeedParser.cs:15 (в связке с Contracts.cs:20-23) - десериализация без учёта регистра имён полей

```csharp
return JsonSerializer.Deserialize<SupplierFeed>(clean)
       ?? throw new InvalidOperationException("Пустой фид поставщика");
```

Вызов без `JsonSerializerOptions`, значит `PropertyNameCaseInsensitive` - `false` (дефолт,
подтверждено Microsoft Learn: `JsonSerializerOptions.PropertyNameCaseInsensitive Property` - «By
default, deserialization looks for case-sensitive property name matches»). `SupplierFeed` /
`SupplierItem` объявлены с PascalCase-свойствами (`Items`, `Sku`, `Price`, `ImageUrl`) без
`[JsonPropertyName]`. Внешние JSON-фиды поставщиков по общепринятой конвенции отдают camelCase
(`"sku"`, `"price"`, `"imageUrl"`, `"items"`).

**Чем кончится**: если реальный фид поставщика - camelCase (условие применимости находки, не
подтверждено файлом формата фида - в каталоге его нет), поля не находят соответствия в
конструкторе record и молча получают значения по умолчанию (`Items` - пустой список
конструктора по умолчанию невозможен для required-параметров record, но при частичном
несовпадении - `Sku=null, Price=0, ImageUrl=null`) без исключения - тихая потеря данных вместо
ошибки разбора.

**Severity**: major (условно на регистре реального фида; в блокере №4 сама попытка разбора уже
падает раньше на JsonException, поэтому эта находка проявится, когда №4 будет исправлена).

### 6. src/PricesController.cs:20-25 - результат уведомления не проверяется, ответ клиенту всегда `202 Accepted`

```csharp
var client = httpFactory.CreateClient("notifications");
await client.PostAsync($"/price-changed/{sku}", null, ct);
return Accepted();
```

`HttpClient.PostAsync` не бросает исключение на неуспешный статус-код (бросает только на сетевую
ошибку/таймаут); чтобы узнать про 4xx/5xx нужен явный `EnsureSuccessStatusCode()` или проверка
`IsSuccessStatusCode`. Здесь результат не читается и не логируется.

**Чем кончится**: если сервис уведомлений недоступен или вернул ошибку, вызывающая сторона всё
равно получает `202 Accepted` - «уведомление о смене цены» заявлено как отправленное, хотя оно
могло не дойти, и по коду ответа это невозможно отличить.

**Severity**: major.

### 7. src/CatalogCache.cs (весь файл) - класс не вызывается ничем в изменении

`CatalogCache.GetPageAsync` / `InvalidateAsync` не используются ни одним контроллером, ни одним
обработчиком события в этом изменении (`grep -rn CatalogCache` по всему каталогу даёт только
объявление класса). Комментарий на `CatalogCache.cs:14` («Вызывается из обработчика события
"каталог обновлён"») описывает обработчик, которого в этом наборе файлов нет.

**Чем кончится**: заявленная в MR фича «кэш страниц каталога с инвалидацией по событию» не
подключена к приложению - нет HTTP-эндпоинта, отдающего страницу каталога, и нет подписчика на
событие обновления каталога, вызывающего `InvalidateAsync`. Класс - мёртвый код на момент
ревью (если проводка есть в файлах вне этого изменения - в предоставленном наборе файлов её
не видно).

**Severity**: major.

### 8. src/PricesController.cs:12,20 - `sku` не валидируется на пустое/пробельное значение

Маршруты `GET /prices/{sku}` и `POST /prices/{sku}/notify` не проверяют `sku` на пустоту или
пробелы (в отличие от `discount`, для которого есть явная проверка диапазона на строке 14).
Пустой/пробельный `sku` дойдёт до `supplier.GetPriceAsync` и до ключа кэша `price: ` /
`price:   `.

**Чем кончится**: бессмысленные запросы к поставщику и записи в кэше на вырожденный `sku`;
последствие ограничено (не ведёт к падению), но нарушает симметрию с уже существующей валидацией
`discount`.

**Severity**: minor.

## Итог по severity

- blocker: 3 (находки 1, 2, 4)
- major: 4 (находки 3, 5, 6, 7)
- minor: 1 (находка 8)

Всего находок: 8.
