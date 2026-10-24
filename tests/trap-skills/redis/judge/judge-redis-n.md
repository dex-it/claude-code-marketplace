# Судья: redis, набор n (g-c-n1, g-c-n2, rv-c-n1, rv-c-n2)

Пути DIFF.patch: runs/g-c-nX/DIFF.patch (номера строк файла патча). Ревью: REVIEW.md по файл:строка ветки.

## g-c (код). C11 n/a: ADR выбирает RabbitMQ; очередь писем на Streams, Pub/Sub не использован, но решение задано не задачей-ловушкой, клетка n/a по заданию.

| единица | n1 | n2 | основание |
|---|---|---|---|
| C1 | 1 | 1 | n1: DIFF:561 singleton `AddSingleton<IConnectionMultiplexer>`; n2: DIFF:663 то же |
| C2 | 1 | 1 | n1: DIFF:564 `AbortOnConnectFail = false`; n2: DIFF:667 |
| C3 | 1 | 1 | n1: PriceCache DIFF:454 `StringSetAsync(..., ttl)` (5 мин с джиттером), корзина TTL :97; n2: DIFF:398-403 `SET ... PX` (10 мин с джиттером) |
| C4 (Н) | 1 ? | 1 ? | n1: DIFF:412,431 `ConcurrentDictionary<Lazy<Task>>` single-flight на sku в процессе; n2: DIFF:339,360. ? - повторной проверки Redis внутри `LoadAsync` нет (вызов в источник сразу), окно между `TryRemove` и поздним вызывающим остаётся; принят допустимый вариант "single-flight в процессе", повторная проверка не проверена на вычет. Клетка наблюдаемая |
| C5 | 1 | 1 | n1: DIFF:70-74,437-441 вебхук -> `KeyDeleteAsync`; n2: DIFF:66-73,364-371 Lua INCR версии + DEL |
| C6 | 1 | 1 | n1: DIFF:414 `price:{sku}`, :101 `cart:{id}`, :167 `lock:`; n2: DIFF:341 `price:{sku}`, :448 `cart:`, :539 `lock:` |
| C7 | 1 | 1 | n1: DIFF:160-161,185-186 Lua release с токеном; n2: DIFF:528-533,631 |
| C8 | 1 | 1 | n1: DIFF:169 `StringSetAsync(key, token, ttl, NotExists)`, TTL 30 с + продление :213-248; n2: DIFF:515 `SET NX PX` + продление :582-623 |
| C9 | 1 | 1 | n1: fencing INCR DIFF:175, `FencingToken`/`LostToken` в `IStockRecalculator` :37, :633, продление с проверкой владения :158-159,224; n2: DIFF:515-516 fence в Lua, :820 токен в `RecalculateAsync`, продление :596-613. Само условное обновление MongoDB не реализовано (интерфейс-порт, реализации нет), но контракт ограждения задан в обоих |
| C10 | 1 | 1 | n1: DIFF:92-141 Hash, поле на позицию (HSET/HDEL); n2: DIFF:438-496 Hash |
| C11 | n/a | n/a | ADR выбирает RabbitMQ (по заданию кейса) |
| C12 | 1 | 1 | n1: DIFF:478-498 ZSET скользящее окно в Lua, атомарно; n2: DIFF:700-719 то же |

## rv-c (ревью catalog-cache). Пути - src/Fulfil/Caching/...

| единица | n1 | n2 | основание |
|---|---|---|---|
| C1 | 1 | 1 | ApiKeyRateLimiter.cs:20 `ConnectAsync` на запрос: рукопожатие, исчерпание сокетов (blocker в обоих) |
| C2 | 1 | 1 | RedisConnection.cs:21 дефолт AbortOnConnectFail=true, сервис не поднимается (blocker) |
| C3 | 1 | 1 | PriceCache.cs:23 без TTL, цена устаревает бессрочно (major / blocker) |
| C4 | 1 ? | 1 | n1: PriceCache.cs:23 приписка "нет защиты от stampede на промахе" - место :23 рядом с ключом :19-23, последствие не расшифровано (? слабое); n2: PriceCache.cs:19 промах -> все параллельные идут в IPriceSource (minor). Клетка наблюдаемая |
| C5 | 1 | 1 | n1: PriceEndpoints.cs:12 вебхук не инвалидирует; n2: PriceCache.cs:23 + PriceEndpoints.cs:12-16 |
| C6 | 1 | 1 | PriceCache.cs:11 голый sku, коллизии (major / minor) |
| C7 | 1 | 1 | RedisLock.cs:17 release без токена, чужой лок снесён |
| C8 | 1 | 1 | RedisLock.cs:12 без TTL, пересчёт встаёт навсегда |
| C9 | 1 | 1 | StockRecalculatorJob.cs:27 нет продления/fencing, две реплики пишут в Mongo |
| C10 | 1 | 1 | CartStore.cs:16 RMW целиком JSON, теряются изменения |
| C11 | 1 | 1 | MailJobQueue.cs:27 Pub/Sub: письмо теряется без подписчика (blocker); дубли на репликах |
| C12 | 1 | 1 | ApiKeyRateLimiter.cs:23 фиксированное окно, до 200 на границе (major); n2 также :24 неатомарность |
| P1 | 1 | 1 | n1: OrderStatusCache.cs:7 заявлен minor (не blocker/major) -> 1; n2 не заявлена |
| P2 | 1 | 1 | n1: CartStore.cs:12 заявлен minor -> 1; n2 не заявлена |
| O1 | 1 | 1 | PriceCache.cs:13 `Math.Round`, 19.99 -> 20 (blocker) |
| O2 | 1 | 1 | ApiKeyRateLimiter.cs:28 ключ API в лог (major) |

## Н (находки сверх ключа, без вердикта)
- g-c-n1/n2: интерфейсы `IStockRecalculator`/`IMailSender` без реализаций; условная запись по fence в MongoDB не показана (n2 прямо оговорил в ANSWER).
- g-c-n2: версионный счётчик инвалидации цены (защита от гонки "поздний ответ источника затирает инвалидацию") - сверх ключа; n1 делает аналог через `TryRemove` in-flight.
- g-c-n1: `maxmemory-policy volatile-lru` в compose при очереди без TTL; n2 - `noeviction`. Оба меняют compose осознанно.
- rv-c n1/n2: вебхук `/internal/price-changed` без аутентификации (настоящее, minor/major); неатомарность агрегата и `UpdateOne` в StockRecalculatorJob.cs:32 (настоящее); произвольные `X-Api-Key` плодят ключи `rate:*` (настоящее, minor); INCR+EXPIRE неатомарны (RateLimiter:23-24, часть C12).
- rv-c-n1: fire-and-forget `_ = HandleAsync` в MailJobQueue.cs:35 без ограничения (настоящее); побочная регистрация Mongo в `AddRedisCaching` (RedisConnection.cs:23, замечание о структуре). rv-c-n2: fire-and-forget там же (minor).

## Итог по единицам (все кейсы с клеткой: g-c n1,n2 + rv-c n1,n2)

| единица | итог |
|---|---|
| C1, C2, C3, C5, C6, C7, C8, C9, C10, C12 | g-c 2/2, rv-c 2/2 |
| C4 | g-c 2/2 ?, rv-c 2/2 (n1 ? слабое последствие) - наблюдаемая клетка (Н) |
| C11 | g-c n/a; rv-c 2/2 |
| P1, P2 | rv-c 2/2 |
| O1, O2 | rv-c 2/2 |

Не-2/2: нет. Спорные: C4 (g-c n1/n2: нет повторной проверки кэша в single-flight; rv-c n1: stampede одной фразой без последствия), C9 в g-c (fence передан в порт, но условная запись в MongoDB не реализована - принято как решение "токен-ограждение" на уровне контракта).
