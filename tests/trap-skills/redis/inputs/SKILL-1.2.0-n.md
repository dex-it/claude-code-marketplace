---
name: redis
description: Redis — кэширование, distributed lock, rate limiting, ловушки. Активируется при redis, cache, distributed cache, pub sub, lock, rate limit, StackExchange, ioredis, bullmq, session store, TTL, expire, redis cluster, sentinel, ZADD, key-value store
---

# Redis - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Старт сервиса при недоступном Redis
- Распределённый лок защищает запись в общий ресурс: лок может быть потерян до конца работы
- Лимит запросов в окне: всплеск на границе окон
