---
name: mongodb
description: MongoDB — schema design, индексы, aggregation, ловушки. Активируется при mongodb, mongo, bson, aggregation pipeline, document database, mongoose, mongosh, replica set, ObjectId, collection, find, updateMany, atlas, NoSQL
---

# MongoDB — ловушки и anti-patterns

## Подключение

### MongoClient на каждый запрос
Плохо: `new MongoClient("mongodb://localhost")` внутри метода — каждый вызов создает новый connection pool
Правильно: MongoClient как Singleton через DI — один экземпляр на приложение
Почему: MongoClient содержит connection pool внутри, thread-safe. Новый клиент на запрос = утечка соединений, исчерпание лимита

## Schema Design

### Unbounded array в документе
Плохо: `List<LogEntry> ActivityLog` внутри User — массив растет бесконечно
Правильно: отдельная коллекция `activity_logs` с `UserId` как reference
Почему: документ > 16MB = `MongoBulkWriteException`. Даже до лимита — чтение/запись всего массива при каждом обращении

### Embed для часто меняющихся данных
Плохо: embed User внутри Order — при смене email обновлять все заказы
Правильно: reference по `CustomerId`, embed только данные которые читаются вместе и редко меняются
Почему: update embedded data = обновление каждого документа где embed встречается. Для 10000 заказов = 10000 update операций

### Reference для co-read данных
Плохо: `ShippingAddress` как отдельная коллекция — лишний запрос при каждом чтении заказа
Правильно: embed `Address` внутри Order — всегда читаются вместе, bounded, редко меняется
Почему: каждый reference = дополнительный запрос. Embed для bounded co-read данных дает один запрос вместо двух

## Индексы

### Запрос без индекса — collection scan
Плохо: `Find(o => o.Status == "pending" && o.CreatedAt > cutoff)` без compound index
Правильно: compound index по ESR rule: `Ascending(Status)` + `Descending(CreatedAt)`
Почему: без индекса MongoDB сканирует ВСЮ коллекцию. На миллионе документов — секунды вместо миллисекунд

### ESR rule нарушен — порядок полей в индексе
Плохо: индекс `{ CreatedAt: -1, Status: 1 }` — Range перед Equality
Правильно: ESR: Equality первый, Sort второй, Range последний
Почему: неправильный порядок = индекс используется частично или не используется. Проверяй через `explain()`

### Нет TTL index для временных данных
Плохо: cron job для удаления старых audit logs / sessions
Правильно: TTL index: `CreateIndexModel` с `ExpireAfter = TimeSpan.FromDays(30)` на поле даты
Почему: TTL index удаляет автоматически, не требует кода, не нагружает приложение

## Запросы

### Чтение всего документа для одного поля
Плохо: `Find(filter).ToListAsync()` + `.Select(o => o.Id)` в приложении
Правильно: `Find(filter).Project(Builders<T>.Projection.Include(o => o.Id)).ToListAsync()`
Почему: без projection MongoDB передает весь документ по сети. Для документов с большими полями — значительный overhead

### Polling вместо Change Streams
Плохо: `while (true) { Find(new).ToListAsync(); Task.Delay(5000); }` — polling каждые N секунд
Правильно: `WatchAsync` с pipeline filter по `OperationType`
Почему: polling = лишние запросы + задержка до N секунд. Change Streams — реактивно, без задержки, без лишней нагрузки

### IgnoreExtraElements не настроен
Плохо: добавление нового поля в класс ломает чтение старых документов (нет поля в BSON)
Правильно: `ConventionPack` с `IgnoreExtraElementsConvention(true)` зарегистрирован глобально
Почему: без конвенции удаление/переименование поля в коде = exception при десериализации существующих документов

## Транзакции

### Транзакция без Replica Set
Плохо: `StartSessionAsync` + `StartTransaction` на standalone MongoDB
Правильно: транзакции работают только на Replica Set (минимум 1 node RS). Для dev — `rs.initiate()`
Почему: standalone MongoDB не поддерживает multi-document transactions. Ошибка только в runtime

## Чек-лист

- MongoClient — Singleton
- Нет unbounded arrays в документах
- Индексы на поля в фильтрах (ESR rule)
- Projection для частичного чтения
- Embed для co-read data, Reference для independent
- TTL index для auto-cleanup
- Transactions только при необходимости (Replica Set обязателен)
- IgnoreExtraElements convention
