Все шесть пунктов FUL-13 реализованы в рабочем дереве, ничего не закоммичено. Сборки и тестов не было, так что код не компилировался и не запускался.

**Изменённые файлы**
- Изменены: `src/Fulfil/Program.cs`, `src/Fulfil/Ports/Ports.cs`, `docker-compose.yml`.
- Новые:
  - `src/Fulfil/Redis/RedisServiceCollectionExtensions.cs`
  - `src/Fulfil/Redis/RedisLock.cs`
  - `src/Fulfil/Prices/PriceCache.cs`
  - `src/Fulfil/Stock/StockRecalculationService.cs`
  - `src/Fulfil/RateLimiting/ApiRateLimitMiddleware.cs`
  - `src/Fulfil/Carts/CartStore.cs`
  - `src/Fulfil/Mail/EmailQueue.cs`
  - `src/Fulfil/Mail/EmailWorker.cs`

**Решения**
- **Старт и сбои Redis:** сервис стартует без Redis (`AbortOnConnectFail=false`). Чтение цены при сбое идёт в источник, а лимит запросов пропускает запросы. `POST /internal/price-changed` при сбое отвечает 503, чтобы ценовой сервис повторил вызов.
- **Цены:** конкурентные промахи по одному sku внутри реплики схлопываются в один запрос к `IPriceSource`. TTL 5 минут с разбросом ±10%. Инвалидация увеличивает версию sku, и запоздавший ответ источника не затирает свежую инвалидацию.
- **Пересчёт остатков:** лок на 30 секунд с продлением. При потере лока отменяется токен прохода, а сам проход получает монотонный токен ограждения. Запись в MongoDB должна быть условной по этому токену; это описано в контракте `IStockRecalculator`, но сама запись не реализована.
- **Лимит запросов:** скользящее окно на sorted set в Lua, время берётся из Redis, без всплеска на границе окон. Запрос без `X-Api-Key` получает 401, это моё допущение.
- **Корзина:** hash `cart:{id}` с полями `i:{sku}` и `promo`. Позиции и промокод меняются независимо, читается целиком одним `HGETALL`, TTL 30 дней.
- **Письма:** Redis Streams с группой потребителей. Неподтверждённые задания подхватываются через `XAUTOCLAIM`, после 5 неудачных доставок уходят в `mail:dead`. Доставка at-least-once.
- **Память:** `maxmemory` задан в compose (256mb, `volatile-lru`), включён AOF. Вытесняются только ключи с TTL, а очередь писем вытеснению не подвержена.

**Чего нет в репозитории**
- Реализаций `IPriceSource`, `IStockRecalculator` и `IEmailSender`. `StockRecalculator` из задачи в коде не нашёлся, поэтому я завёл порты. Пока их реализации не зарегистрированы в DI, сервис не стартует.
- Эндпоинтов для корзины и постановки писем в очередь. `CartStore` и `EmailQueue` зарегистрированы, но к HTTP не подключены.
