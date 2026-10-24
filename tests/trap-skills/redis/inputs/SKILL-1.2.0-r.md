---
name: redis
description: Redis - старт сервиса без Redis, потеря распределённого лока, лимит запросов на границе окон. Активируется при redis, distributed lock, rate limit, rate limiting, AbortOnConnectFail, StackExchange.Redis, ioredis, cache, TTL, sliding window, fixed window, sentinel
---

# Redis - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Старт сервиса при недоступном Redis
- Конкурентные промахи горячего ключа идут в источник каждый
- Распределённый лок защищает запись в общий ресурс: лок может быть потерян до конца работы
- Лимит запросов в окне: всплеск на границе окон
