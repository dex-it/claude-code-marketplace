# Ревью MR: Pricing.Api

## blocker

### 1. src/PriceService.cs:22 — целочисленное деление, скидка не применяется
`discountPercent / 100` — деление `int` на `int`, для 0..99 даёт 0. Скидка применяется только при 100% (цена становится 0).
Итог: клиенты получают цену без скидки при любом значении 1..99 (при 100 — бесплатный товар). Прямые финансовые потери/ошибки в ценах.
Исправление (для автора): `basePrice * discountPercent / 100m`.

### 2. src/SupplierFeedParser.cs:10,14 — regex `//.*$` режет URL внутри строк
Регэксп не учитывает строковые литералы JSON. В `"ImageUrl": "https://cdn.supplier.example/img/123.png"` всё после `https:` вырезается, остаётся незакрытая строка.
Итог: `JsonException` на любом фиде с URL картинки (а `ImageUrl` в контракте — абсолютный https-адрес), разбор фида не работает вообще.
Кроме того, утверждение в комментарии неверно: в System.Text.Json есть `JsonCommentHandling.Skip` (`JsonSerializerOptions.ReadCommentHandling`), regex не нужен.

### 3. src/PriceService.cs:7-15 — нет защиты от дублирующих вызовов поставщика
Комментарий неверен: `IMemoryCache.GetOrCreateAsync` НЕ гарантирует единственный вызов фабрики; при параллельных запросах на промахе кэша фабрика выполняется несколько раз.
Итог: при холодном кэше/истечении TTL на популярном SKU уходит N параллельных запросов к поставщику; лимит 5 rps на ключ (Contracts.cs:5) превышается → бан ключа на час → цены недоступны для всего сервиса. Ошибки при этом не кэшируются, так что при сбое поставщика каждый запрос снова бьёт в API (усиление нагрузки).
Нужно: per-key `SemaphoreSlim`/`Lazy<Task>` или `HybridCache` (single-flight), плюс клиентский rate limiter и негативное кэширование/backoff.

## major

### 4. src/PriceService.cs:14 — токен отмены первого запроса попадает в общую фабрику
`ct` первого вызывающего захвачен замыканием, результат кэшируется для всех. Если первый клиент отключился — фабрика бросает `OperationCanceledException`, а ожидающие этого же вычисления (если оно разделяется) получают отмену чужого запроса → ложные 5xx/499 для других клиентов.

### 5. src/PricesController.cs:19-24 — Notify: результат вызова игнорируется, клиент "notifications" нигде не настроен
- `PostAsync` без `EnsureSuccessStatusCode`/проверки статуса: при 4xx/5xx возвращается 202 Accepted, уведомление тихо теряется.
- В MR нет `Program.cs`/регистрации DI: ни `AddHttpClient("notifications")` с `BaseAddress`, ни `PriceService`, `HybridCache`, `IMemoryCache`, реализаций `ISupplierClient`/`ICatalogRepository`. Для именованного клиента без `BaseAddress` относительный URI `/price-changed/...` даёт `InvalidOperationException`; сервис не стартует/падает на первом запросе.
- Нет таймаута/ретраев (Polly/resilience handler).

### 6. src/CatalogCache.cs:17 / Pricing.Api.csproj:7 — инвалидация по тегу и пакет Hybrid 9.3.0
`Microsoft.Extensions.Caching.Hybrid` 9.3.0 — preview-версия; в ранних версиях тегирование/`EvictByTagAsync` работало только для локального L1 и не распространялось на L2 (Redis) и другие инстансы. Итог: при нескольких инстансах после события «каталог обновлён» часть узлов отдаёт устаревшие страницы до истечения TTL. Нужно перейти на GA-версию и проверить поведение инвалидации на нескольких узлах; также нигде не задан TTL (`HybridCacheEntryOptions`) — используется умолчание.

## minor

### 7. src/PricesController.cs:23 — `sku` подставляется в URL без экранирования
`$"/price-changed/{sku}"` — `sku` со спецсимволами (`/`, `?`, `..`) изменяет путь запроса к внутреннему сервису. Использовать `Uri.EscapeDataString`. Также эндпоинт POST без авторизации — любой может спамить уведомлениями.

### 8. src/PriceService.cs:23 — `Math.Round` по умолчанию банковское округление
`MidpointRounding.ToEven` для денег обычно неверно (ожидается `AwayFromZero`); копейки расходятся с ожиданиями бизнеса/поставщика.

### 9. src/CatalogCache.cs:7-12 — гонка инвалидации и загрузки
Страница, загруженная до события, но записанная в кэш после `EvictByTagAsync`, останется устаревшей до TTL. Для строгой согласованности нужна версия/поколение каталога в ключе.

### 10. src/SupplierFeedParser.cs:15 — десериализация без опций
Регистрозависимые имена (`Sku`/`Price`/`ImageUrl`) при типичном camelCase-фиде дадут `null`/0 без ошибки (`Price` = 0 — тихо!). Задать `PropertyNameCaseInsensitive`/`JsonSerializerDefaults.Web`. Нет валидации `Price > 0`, `Items == null`.

### 11. src/PricesController.cs:9-10, 18 — комментарии
Комментарий про IHttpClientFactory справедлив, но `PricesController` берёт `IHttpClientFactory` вместо типизированного клиента/сервиса — логика уведомления лежит в контроллере. Рефакторинг по желанию.
