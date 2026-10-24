# Review MR: Pricing.Api

Ревью нового кода каталога `src/`. Факты об API/дефолтах фреймворков сверены с
Microsoft Learn (см. ссылки в находках 1 и 2); остальное - трассировка кода.

## Blocker

### 1. `src/CatalogCache.cs:17` - вызов несуществующего метода `EvictByTagAsync`

Что не так: `HybridCache` не содержит метод `EvictByTagAsync`. В API (net9.0,
`Microsoft.Extensions.Caching.Hybrid` 9.3.0) инвалидация по тегу называется
`RemoveByTagAsync` (подтверждено Microsoft Learn:
https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.caching.hybrid.hybridcache.removebytagasync).

Чем кончится: код не компилируется - `CS1061 'HybridCache' does not contain a
definition for 'EvictByTagAsync'`. Сборка всего проекта падает.

Severity: blocker.

### 2. `src/PriceService.cs:7-8` (комментарий) и `:11-15` (вызов) - `IMemoryCache.GetOrCreateAsync` не даёт single-flight, вопреки комментарию

Что не так: комментарий утверждает, что `GetOrCreateAsync` вызывает фабрику
"один раз на ключ даже при параллельных запросах". Это не так для
`Microsoft.Extensions.Caching.Memory.CacheExtensions.GetOrCreateAsync` - метод
делает check-then-act (`TryGetValue`, затем при отсутствии - создание записи и
await фабрики) без блокировки по ключу; при параллельных запросах на один и
тот же непрогретый `sku` фабрика (вызов `supplier.GetPriceAsync`) запускается
параллельно у каждого запроса. Подтверждено сопровождающими .NET
(dotnet/runtime#71581: "If you call GetOrCreateAsync from multiple threads the
factory Func will be called multiple times"). Single-flight гарантирует только
`HybridCache.GetOrCreateAsync` (использован в `CatalogCache`, не здесь).

Чем кончится: несколько параллельных запросов на один `sku` без прогретого
кэша (например, сразу после истечения 5-минутного TTL у популярного товара)
дают несколько одновременных вызовов `ISupplierClient.GetPriceAsync`. По
контракту (`src/Contracts.cs:5`) у поставщика лимит 5 запросов в секунду на
ключ, превышение - бан ключа на час. Всплеск параллельных запросов на один
или несколько ключей за один момент реалистично превышает лимит и обнуляет
получение базовой цены для всех sku на час.

Severity: blocker.

### 3. `src/PriceService.cs:22` - скидка не применяется из-за целочисленного деления

Что не так: `discountPercent` - `int` (из `[FromQuery] int discount` в
контроллере). Выражение `discountPercent / 100` - деление `int` на `int`,
результат усечён к нулю. Для любого `discountPercent` в диапазоне [1, 99]
результат `0`; скидка применяется как ноль. Для `discountPercent == 100`
результат `1`, и `discounted = basePrice - basePrice * 1 = 0`
(корректно только в этом единственном случае).

Чем кончится: `GetFinalPriceAsync` возвращает `basePrice` без изменений для
любого запрошенного `discount` от 1 до 99 - "финальная цена со скидкой" из
описания MR не реализована для типового диапазона скидок. Заметно только на
проде/QA, юнит-тест с discount=100 или discount=0 эту ветку не поймает.

Severity: blocker.

### 4. `src/SupplierFeedParser.cs:10,14` - regex-вырезание комментариев ломает JSON с URL

Что не так: `LineComment` (`@"//.*$"`, Multiline) вырезает всё от первого `//`
до конца строки, чтобы убрать комментарии поставщика. Regex не различает `//`
внутри JSON-строки и настоящий комментарий. `SupplierItem.ImageUrl`
(`src/SupplierFeedParser.cs:22-23`) по контракту содержит абсолютный URL вида
`https://cdn.supplier.example/img/123.png` - то есть содержит `//` в каждом
реальном значении. При разборе такой фид-строки regex вырезает всё после
`https:` до конца строки (для однострочного/минифицированного JSON - до конца
всего документа, для многострочного - до конца текущей строки), обрезая
закрывающую кавычку значения и последующую структуру JSON.

Чем кончится: `JsonSerializer.Deserialize<SupplierFeed>` получает
незакрытую строку/некорректный JSON и бросает `JsonException` - парсинг фида
падает на любом элементе с `ImageUrl`, то есть фактически на любом реальном
фиде поставщика (сам код документирует этот формат значения в комментарии
к `ImageUrl`).

Severity: blocker.

## Major

### 5. `src/PricesController.cs:23` - `sku` подставляется в путь исходящего запроса без экранирования

Что не так: `client.PostAsync($"/price-changed/{sku}", null, ct)` строит путь
конкатенацией строк из значения маршрута `sku` без `Uri.EscapeDataString`
(или построения через `PathString`/`UriBuilder`). `sku` в самом коде не
валидируется никаким regex/allowlist ни здесь, ни в `PriceService`. ASP.NET
Core разбивает URL на сегменты маршрута по литеральному `/` до декодирования,
но декодированное значение сегмента может содержать `/` и другие символы,
если они были percent-encoded в исходном URL (`%2F`, `%2E%2E` и т.д.) - это
пройдёт биндинг `{sku}` как обычная строка.

Чем кончится: клиент с percent-encoded `sku` (например `..%2Fadmin`) управляет
путём исходящего запроса к сервису нотификаций сверх `/price-changed/<sku>` -
путь-инъекция/обход пути на стороне вызываемого сервиса нотификаций.

Severity: major.

### 6. `src/CatalogCache.cs` - класс не подключён ни к одному потребителю

Что не так: `GetPageAsync` и `InvalidateAsync` не вызываются ни из одного
файла каталога (проверено `grep` по всему `src/`: единственные упоминания -
в самом `CatalogCache.cs`). Комментарий на `InvalidateAsync`
(`src/CatalogCache.cs:14`) утверждает, что метод "вызывается из обработчика
события 'каталог обновлён'" - такого обработчика в поставке нет. Ни один
контроллер не вызывает `GetPageAsync`.

Чем кончится: заявленная в описании MR функциональность "кэш страниц каталога
с инвалидацией по событию" в этой поставке не достижима ни с одной внешней
точки входа - код мёртв до тех пор, пока подписка на событие и точка чтения
страницы не появятся (в этом MR их нет).

Severity: major.

## Minor

### 7. `src/PricesController.cs:20-24` - ошибка вызова нотификации не обрабатывается

Что не так: `Notify` не проверяет `HttpResponseMessage` от `PostAsync` и не
оборачивает вызов в try/catch. Любая сетевая ошибка, таймаут или неуспешный
статус у сервиса нотификаций всплывает как необработанное исключение из
контроллера.

Чем кончится: недоступность стороннего сервиса нотификаций превращает
`POST /prices/{sku}/notify` в 500 вместо ожидаемого поведения "приняли на
доставку" (`Accepted()`), хотя по смыслу операции нотификация - fire-and-forget
и не должна валить ответ вызывающей стороне.

Severity: minor.

## Итог по severity

- blocker: 4
- major: 2
- minor: 1
