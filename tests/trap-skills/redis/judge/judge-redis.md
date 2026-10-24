# Судья: СКИЛЛ=redis (claude-sonnet-5-5, набор c)

## g-c (код, price-cache). Пути - DIFF.patch соответствующего прогона
| единица | c1 | c2 | основание |
|---|---|---|---|
| C1 | 1 | 1 | c1 Program.cs:119-124 singleton IConnectionMultiplexer; c2 Program.cs:364-369 |
| C2 | 1 | 1 | c1 :122 AbortOnConnectFail=false; c2 :367 |
| C3 | 1 | 1 | c1 PriceCache.cs:207-208 TTL 5 мин+jitter; c2 PriceCache.cs:60 TTL 60 с; корзина (30 д), rate-ключ с expire - тоже с сроком |
| C4 (Н) | 1? | 1? | c1 PriceCache.cs:190 Lazy single-flight в процессе; c2 :48. ? повторной проверки кэша внутри загрузки нет (c1 :204, c2 :57), окно гонки после TryRemove; засчитано как single-flight из перечня |
| C5 | 1 | 1 | c1 Program.cs:145-147 + PriceCache.cs:217-221 KeyDelete; c2 Program.cs:397-401 |
| C6 | 1 | 1 | c1 price:/cart:/lock:/rate:; c2 price:/cart:/lock:stock-recalc/rl: |
| C7 | 1 | 1 | c1 RedisLock.cs:360-361,425 Lua compare-and-del; c2 RedisLock.cs:152-153,227 |
| C8 | 1 | 1 | c1 RedisLock.cs:389 expiry Lease 30 с + продление :406; c2 :161 ttl + продление :195 |
| C9 | 1 | 1? | c1 RedisLock.cs:392 INCR fence, StockRecalcJob.cs:51 передаёт токен, Ports.cs:90-95 запись обязана его проверять + LostToken :50. c2: токена-ограждения нет; есть продление с проверкой владения (RedisLock.cs:154-155,195), отмена прохода при потере (:200,:279) и требование идемпотентности (Ports.cs:330-331). ? запись в Mongo не реализована, защита - отмена после обнаружения потери и контракт; засчитано по перечню (продление с проверкой владения/идемпотентность), спорно |
| C10 | 1 | 1 | c1 RedisCart.cs:293-313 Hash+HINCRBY; c2 CartStore.cs:92-125 Hash |
| C11 | n/a? | n/a? | оба сделали очередь писем на RabbitMQ/MassTransit (c1 SendEmailConsumer.cs:74-76, Program.cs:129-137; c2 Mail/SendEmail.cs:304, Program.cs:376-385), Redis-очереди и Pub/Sub нет; ситуации «очередь в Redis» в выходе нет. ? RabbitMQ по ADR-0001 (среда), не засчитан |
| C12 | 0 | 1 | c1 RateLimitMiddleware.cs:233,243,260 фиксированное окно INCR+EXPIRE (Lua) - провал по ключу; c2 ApiRateLimitMiddleware.cs:452-466 ZSET скользящее окно в Lua |

## rv-c (ревью, catalog-cache)
| единица | c1 | c2 | основание |
|---|---|---|---|
| C1 | 1 | 1 | оба ApiKeyRateLimiter.cs:20, последствие: сокеты/латентность |
| C2 | 0 | 1 | c1: находки про RedisConnection только :28 (IPriceSource), падения на старте нет; c2 RedisConnection.cs:13 AbortOnConnectFail=true -> сервис не поднимается (minor, K не требует severity) |
| C3 | 1 | 1 | оба PriceCache.cs:23 без TTL, цена бессрочно |
| C4 | 0 | 0 | PriceCache.cs:19-23: ни одной находки про шторм промахов/вызовы источника |
| C5 | 1 | 1 | оба PriceEndpoints.cs:12 (и PriceCache.cs:23): ключ не инвалидируется, старая цена |
| C6 | 1 | 1 | оба PriceCache.cs:11; c1 - перехват чужих ключей lock:/rate:, c2 - коллизии |
| C7 | 1 | 1 | оба RedisLock.cs:17, DEL без токена, два исполнителя |
| C8 | 1 | 1 | оба RedisLock.cs:12, нет expiry, пересчёт встаёт навсегда |
| C9 | 0 | 0 | StockRecalculatorJob.cs:41-42/RedisLock.cs:5: про запись без токена-ограждения ничего; c1 :17 и c2 :17 - это C7; c2 :39 - bulk, не C9 |
| C10 | 1 | 1 | c1 CartStore.cs:15, c2 :16: целиковый JSON, потеря позиций при гонке |
| C11 | 1 | 1 | оба MailJobQueue.cs:27,35: потеря при рестарте, тройная доставка |
| C12 | 0? | 0? | оба ApiKeyRateLimiter.cs:23: найдена неатомарность INCR/EXPIRE (ключ навсегда в 429), но не фиксированное окно/до 200 запросов на границе; последствие, снимаемое ключом (скользящее окно), не названо. ? место верное, последствие другое |
| P1 | 1 | 1 | OrderStatusCache.cs:7,12 не заявлена |
| P2 | 1 | 1 | CartStore.cs:12 (v2:cart) не заявлена |
| O1 | 1 | 1 | оба PriceCache.cs:13 Math.Round, 19.99->20 (blocker) |
| O2 | 1 | 1 | оба ApiKeyRateLimiter.cs:28 ключ в логе |

## Н (сверх ключа, без вердикта)
- g-c c1/c2: /internal/price-changed без аутентификации (оба отметили в ANSWER).
- g-c c1: fail-open лимитера и Redis-политика volatile-lru на корзинах (вытеснение корзин, сами отметили). c1 `_inflight.TryRemove` в InvalidateAsync не отменяет идущую загрузку - гонка устаревшей цены в пределах TTL.
- g-c c2: корзина `SetItemAsync` HSET - перезапись количества, не инкремент; допустимо.
- rv-c c1: MailJobQueue:35 fire-and-forget обработчик (minor, настоящее); PriceCache:11 инъекция чужого ключа через URL (c1 :4, настоящее).
- rv-c c2: StockRecalculatorJob.cs:39 UpdateOne в цикле (minor, настоящее); Program.cs:9 нет fail-open при недоступности Redis (настоящее).
- rv-c c1 :5 IPriceSource не зарегистрирован - зависит от main, спорно.

## Итог по единицам (все прогоны, где есть клетка)
| единица | g-c | rv-c | общий |
|---|---|---|---|
| C1 | 2/2 | 2/2 | 4/4 |
| C2 | 2/2 | 1/2 | 3/4 |
| C3 | 2/2 | 2/2 | 4/4 |
| C4 (Н) | 2/2 ? | 0/2 | 2/4 |
| C5 | 2/2 | 2/2 | 4/4 |
| C6 | 2/2 | 2/2 | 4/4 |
| C7 | 2/2 | 2/2 | 4/4 |
| C8 | 2/2 | 2/2 | 4/4 |
| C9 | 2/2 ? (c2 спорно) | 0/2 | 2/4 |
| C10 | 2/2 | 2/2 | 4/4 |
| C11 | n/a ? | 2/2 | 2/2 (код: нет клетки) |
| C12 | 1/2 | 0/2 ? | 1/4 |
| P1, P2, O1, O2 | - | 2/2 каждая | 2/2 |
