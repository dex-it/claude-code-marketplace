# FUL-33: Redis - кэш цен, пересчёт остатков, лимит запросов

Подключаю `StackExchange.Redis` и переношу в него горячие данные.

- `PriceCache` отдаёт цену через Redis, вебхук `POST /internal/price-changed` принимает уведомления ценового сервиса.
- `StockRecalculatorJob` раз в минуту пересчитывает остатки в MongoDB под `RedisLock`, чтобы работала одна реплика.
- `ApiKeyRateLimiter` ограничивает `/api/*` до 100 запросов в минуту на `X-Api-Key`, сверх лимита 429.
- `CartStore` хранит корзину (позиции, промокод), `MailJobQueue` и `MailWorker` - очередь писем.
