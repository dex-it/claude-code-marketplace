src/Fulfil/Caching/PriceCache.cs:13 - Math.Round(price) отбрасывает копейки: из кэша отдаётся округлённая цена, заказы считаются по неверной сумме - blocker
src/Fulfil/Caching/PriceCache.cs:23 - цена пишется без TTL, а вебхук price-changed ничего не инвалидирует: устаревшая цена остаётся в Redis навсегда - blocker
src/Fulfil/Caching/PriceEndpoints.cs:12 - обработчик /internal/price-changed только пишет в лог и не удаляет ключ из кэша; к тому же эндпоинт без аутентификации, любой может слать вызовы - major
src/Fulfil/Caching/PriceCache.cs:11 - ключ равен голому sku, без префикса: коллизии с другими данными в том же Redis (например, sku совпадёт с чужим ключом), возможна порча/подмена значений - major
src/Fulfil/Caching/RedisLock.cs:12 - блокировка ставится без TTL: если реплика упадёт, не снимув лок, пересчёт остатков встанет на всех репликах навсегда - blocker
src/Fulfil/Caching/RedisLock.cs:17 - Release делает безусловный DEL без проверки токена: после истечения/перехвата удалит чужой лок, и пересчёт пойдёт на двух репликах одновременно - major
src/Fulfil/Caching/ApiKeyRateLimiter.cs:20 - на каждый запрос создаётся новое ConnectionMultiplexer и закрывается: огромные накладные расходы, на нагрузке исчерпание сокетов/задержки на каждый /api запрос; нужно использовать зарегистрированный IConnectionMultiplexer - blocker
src/Fulfil/Caching/ApiKeyRateLimiter.cs:23 - INCR и EXPIRE неатомарны: при сбое между ними счётчик остаётся без TTL и ключ блокируется по 429 навсегда - major
src/Fulfil/Caching/ApiKeyRateLimiter.cs:28 - в лог пишется значение X-Api-Key целиком: утечка секрета в логи - major
src/Fulfil/Caching/ApiKeyRateLimiter.cs:14 - ключ не проверяется на валидность, лимит считается по произвольной строке: подставляя случайные ключи, лимит обходится, а Redis засоряется неограниченным числом счётчиков - major
src/Fulfil/Caching/MailJobQueue.cs:27 - очередь на Pub/Sub: сообщения не хранятся, письма теряются, если подписчика нет или он перезапускается; повторов и подтверждений нет - blocker
src/Fulfil/Caching/MailJobQueue.cs:35 - каждая реплика подписана на канал и получает каждое сообщение: при нескольких репликах письма уходят дублями; нужен список/Stream с consumer group - blocker
src/Fulfil/Caching/CartStore.cs:16 - read-modify-write корзины целиком одним JSON без атомарности: параллельные SetItem/SetPromo перезаписывают друг друга, позиции или промокод теряются - major
src/Fulfil/Caching/StockRecalculatorJob.cs:39 - по одному UpdateOne на товар в цикле вместо BulkWrite, плюс полный Aggregate по всем stock_movements раз в минуту: при росте данных пересчёт не укладывается в минуту и держит лок - minor
src/Fulfil/Caching/RedisConnection.cs:13 - Parse с AbortOnConnectFail по умолчанию true: если Redis недоступен при старте, синглтон падает и сервис не поднимается/первый запрос падает с 500 - minor
src/Fulfil/Program.cs:9 - при недоступности Redis middleware лимитера бросает исключение и все /api запросы отвечают 500, политики fail-open/closed нет - minor
