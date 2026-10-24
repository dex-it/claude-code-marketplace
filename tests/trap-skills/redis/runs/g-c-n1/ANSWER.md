Задача FUL-13 выполнена в рабочем дереве, без коммита. Сборки не было, код не компилировался и не запускался.

**Изменены:**
- `docker-compose.yml`
- `src/Fulfil/Program.cs`
- `src/Fulfil/Ports/Ports.cs`

**Добавлены:**
- `src/Fulfil/Contracts/MailMessage.cs`
- `src/Fulfil/Redis/RedisExtensions.cs`
- `src/Fulfil/Redis/PriceCache.cs`
- `src/Fulfil/Redis/DistributedLock.cs`
- `src/Fulfil/Redis/StockRecalculationJob.cs`
- `src/Fulfil/Redis/RateLimiter.cs`
- `src/Fulfil/Redis/CartStore.cs`
- `src/Fulfil/Redis/MailQueue.cs`

**Решения:**
- **Старт без Redis:** сервис стартует и при недоступном Redis (`AbortOnConnectFail=false`). Кэш цен в этом случае идёт в источник, лимитер пропускает запросы, фоновые циклы повторяют попытки.
- **Кэш цен:** при промахе на реплике один запрос к `IPriceSource` на каждый sku, TTL 5 минут с разбросом. `POST /internal/price-changed` удаляет ключ.
- **Лок пересчёта:** лок продлевается, пока идёт пересчёт, и отдаёт `LostToken`, который отменяется при потере лока. Fencing-токен передаётся в `IStockRecalculator`, чтобы запись в MongoDB была условной.
- **Лимит запросов:** скользящее окно на sorted set (Lua, время берётся с Redis), без всплеска на стыке окон. Без `X-Api-Key` ответ 401.
- **Корзина и письма:**
  - Корзина — один hash с TTL 30 дней.
  - Очередь писем — Redis Stream с consumer group, подтверждением и повторной выдачей через `XAUTOCLAIM`, поэтому перезапуск воркера письма не теряет.
  - Письмо, доставленное больше 5 раз, уходит в `mail:dead`. Доставка at-least-once, поэтому `IMailSender` должен быть идемпотентным.
- **Redis в compose:** добавлены `appendonly yes`, `maxmemory 256mb` и `volatile-lru`. Вытесняются только ключи с TTL, поток писем без TTL остаётся. Из-за этого при нехватке памяти под давлением могут вытесниться и корзины.

**Для запуска:** в проекте нет реализаций `IPriceSource`, `IStockRecalculator` и `IMailSender` (`StockRecalculator` из задачи тоже отсутствует), а в DI они не зарегистрированы. Пока их не добавят, сервис не поднимется. Корзина и очередь писем пока не подключены к HTTP: нет эндпоинтов, это обычные сервисы.

Ещё одно допущение: если `price-changed` придёт во время запроса к источнику, в кэш на время TTL может попасть старая цена.
