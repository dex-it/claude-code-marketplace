# Ревью MR: Pricing.Api

Источник сверки фактов: context7, `/dotnet/docs` (caching.md, invalid-json.md). Версия проекта: net9.0, Caching.Hybrid 9.3.0.

## Находки

### 1. [blocker] src/PriceService.cs:22 — целочисленное деление в скидке
`discountPercent / 100` — деление int на int, при 0..99 даёт 0. Скидка применяется только при 100 (цена становится 0).
Итог: клиенты видят цену без скидки при любом проценте от 1 до 99, при 100 - бесплатный товар. Исправление: `basePrice * discountPercent / 100m`.

### 2. [blocker] src/SupplierFeedParser.cs:10,14 — регулярка `//.*$` режет содержимое строк
Регулярка не различает комментарий и `//` внутри строкового значения. `ImageUrl` по контракту (SupplierFeedParser.cs:22) - `https://cdn.supplier.example/...`, из него вырезается всё после `https:`, включая закрывающую кавычку.
Итог: JSON невалиден, `JsonException`, фид с картинками не разбирается вообще.

### 3. [major] src/SupplierFeedParser.cs:8-9 — отрицательный факт «в System.Text.Json нет настройки» неверен
Настройка есть: `JsonSerializerOptions.ReadCommentHandling = JsonCommentHandling.Skip` (context7, /dotnet/docs, invalid-json.md); по умолчанию комментарии не разрешены. Штатная замена названа, самописный обход (п.2) не нужен.
Итог: ложный комментарий оправдывает хрупкий код. Заменить регулярку на options, при необходимости `AllowTrailingCommas`. Блочные комментарии `/* */` регулярка тоже не снимает.

### 4. [major] src/CatalogCache.cs:17 — `EvictByTagAsync` не существует
В HybridCache метод называется `RemoveByTagAsync` (context7, /dotnet/docs, caching.md). Сигнатуру `EvictByTagAsync` документация не знает.
Итог: ошибка компиляции, инвалидация кэша каталога по событию не работает, MR не собирается.

### 5. [major] src/PriceService.cs:7-8,11 — комментарий о «гарантии одного вызова фабрики» не подтверждён
Документация (context7) эту гарантию для `IMemoryCache.GetOrCreateAsync` не даёт. Гарантия «только одна конкурентная фабрика» описана для HybridCache, не для IMemoryCache. Статус: `unverifiable`, пока автор не приведёт источник. Фактически это расширение `GetOrCreateAsync` поверх `TryGetValue`/`Set`, без блокировки на ключ (наблюдение не проверялось пробой).
Итог при ложности допущения: при промахе кэша N параллельных запросов на один SKU уходят к поставщику N раз. Лимит из src/Contracts.cs:5 - 5 запросов/с на ключ, превышение - бан ключа на час, то есть остановка всех цен. Нужен per-key lock (например `SemaphoreSlim` на ключ) или HybridCache, плюс общий ограничитель частоты для `ISupplierClient`.

### 6. [major] src/PriceService.cs:14 — токен отмены запроса попадает в общую фабрику кэша
При дедупликации (п.5) или гонке один запрос отменяет работу для остальных ожидающих. Также фабрика не вызывается после отмены, и значение не кэшируется.
Итог: ложные `OperationCanceledException`/500 у соседних запросов при отключении одного клиента.

### 7. [major] src/PricesController.cs:19-24 — результат уведомления игнорируется и нет проверки sku
Ответ `PostAsync` не проверяется (`EnsureSuccessStatusCode`/статус), всегда `Accepted()`. `sku` вставляется в путь без `Uri.EscapeDataString`. Именованный клиент "notifications" нигде не регистрируется в MR (нет Program.cs/AddHttpClient, BaseAddress), с относительным URI будет `InvalidOperationException`. Эндпоинт без авторизации.
Итог: уведомление о смене цены молча теряется при 4xx/5xx; любой может слать уведомления; при sku с `/`, `?` или `..` меняется адресуемый путь (инъекция в путь).

### 8. [major] src/CatalogCache.cs:7-12, csproj:7-8 — HybridCache и Redis не подключены
В MR нет `AddHybridCache`/`AddStackExchangeRedisCache` и конфигурации (Program.cs отсутствует), `HybridCache` и `IMemoryCache` в DI не регистрируются из этого каталога. Неясно, как собирается приложение.
Итог: ошибка запуска при резолве `CatalogCache`/`PriceService`. Если Redis включён как L2, `CatalogPage` должен сериализоваться (record с `IReadOnlyList<string>` - ок для STJ), но это не проверялось.

### 9. [minor] Pricing.Api.csproj:7 — версия Microsoft.Extensions.Caching.Hybrid 9.3.0
Статус статуса релиза (GA или preview) в context7 не подтверждён: `unverifiable`. Нужно сверить с NuGet/changelog, прежде чем фиксировать пакет в проде.

### 10. [minor] src/SupplierFeedParser.cs:15 — разбор без опций
Сопоставление имён свойств в STJ по умолчанию регистрозависимо; фид поставщика в camelCase (`sku`, `price`) не заполнит PascalCase-параметры record, получим `Sku = null` при nullable enable (non-null `string`) и нулевые цены. Формат фида в MR не приведён - стоит задать `PropertyNameCaseInsensitive = true`. Не проверено на реальном фиде.

### 11. [minor] src/PricesController.cs:12 — `discount` по умолчанию 0 и нет валидации `sku`
Отсутствие параметра даёт 0 без ошибки; пустой/произвольный `sku` уходит к поставщику (расход лимита из п.5). Нужны проверка формата sku и, при необходимости, `[Required]`/nullable int.

### 12. [minor] src/PriceService.cs:5-17 — нет обработки ошибок и отрицательных цен поставщика
Нет Polly/timeout/ретраев и валидации (цена <= 0). Итог: неверная цена кэшируется на 5 минут; ошибки поставщика превращаются в 500.

## Не является находкой
Комментарий PricesController.cs:9-10 про `ConfigureAwait(false)` верен по существу (в ASP.NET Core нет `SynchronizationContext`); комментарий PricesController.cs:18 про `IHttpClientFactory` по существу верен, но регистрация клиента не приложена (см. п.7).

## Итого
blocker: 2, major: 6, minor: 4 (всего 12). Статусы `unverifiable`: гарантия фабрики IMemoryCache (п.5), статус пакета Hybrid 9.3.0 (п.9).
