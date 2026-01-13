---
description: Выполнение MongoDB запросов и анализ производительности
allowed-tools: Bash, Read, Grep
---

# /mongo-query

Выполнение MongoDB запросов, анализ explain планов и производительности.

## Использование

```
/mongo-query find [collection] [filter]     # Поиск документов
/mongo-query explain [collection] [query]   # Анализ query plan
/mongo-query indexes [collection]           # Список индексов
/mongo-query stats [collection]             # Статистика коллекции
/mongo-query aggregate [collection] [pipeline]  # Aggregation
```

## Примеры запросов

### 1. Поиск документов

**Через MongoDB MCP:**
```
Запрос: найди все заказы со статусом "pending" за последний час
```

**Через mongosh:**
```bash
mongosh "$MONGODB_URI" --eval '
db.orders.find({
  status: "pending",
  createdAt: { $gte: new Date(Date.now() - 3600000) }
}).limit(10).pretty()
'
```

### 2. Анализ Explain

```bash
mongosh "$MONGODB_URI" --eval '
db.orders.find({
  status: "pending",
  customerId: ObjectId("...")
}).explain("executionStats")
'
```

**Ключевые метрики explain:**

| Метрика | Хорошо | Плохо |
|---------|--------|-------|
| stage | IXSCAN | COLLSCAN |
| totalDocsExamined | = nReturned | >> nReturned |
| executionTimeMillis | < 100ms | > 1000ms |
| indexesUsed | 1+ | 0 |

### 3. Индексы

**Список индексов:**
```bash
mongosh "$MONGODB_URI" --eval 'db.orders.getIndexes()'
```

**Создание индекса:**
```bash
mongosh "$MONGODB_URI" --eval '
db.orders.createIndex(
  { customerId: 1, createdAt: -1 },
  { name: "customer_date_idx", background: true }
)'
```

**Анализ использования индексов:**
```bash
mongosh "$MONGODB_URI" --eval '
db.orders.aggregate([
  { $indexStats: {} }
]).pretty()
'
```

### 4. Aggregation Pipeline

```bash
mongosh "$MONGODB_URI" --eval '
db.orders.aggregate([
  // Фильтрация
  { $match: { status: "completed", createdAt: { $gte: ISODate("2024-01-01") } } },

  // Группировка по дню
  { $group: {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    totalOrders: { $sum: 1 },
    totalRevenue: { $sum: "$total" },
    avgOrderValue: { $avg: "$total" }
  }},

  // Сортировка
  { $sort: { _id: -1 } },

  // Лимит
  { $limit: 30 }
]).pretty()
'
```

### 5. Статистика коллекции

```bash
mongosh "$MONGODB_URI" --eval '
db.orders.stats()
'
```

**Ключевые метрики:**
- `count` - количество документов
- `size` - размер данных
- `avgObjSize` - средний размер документа
- `storageSize` - размер на диске
- `nindexes` - количество индексов
- `totalIndexSize` - размер индексов

### 6. Профилирование

**Включить профилирование:**
```bash
mongosh "$MONGODB_URI" --eval '
db.setProfilingLevel(1, { slowms: 100 })
'
```

**Просмотр медленных запросов:**
```bash
mongosh "$MONGODB_URI" --eval '
db.system.profile.find().sort({ ts: -1 }).limit(10).pretty()
'
```

## Выходной формат

```
MongoDB Query Analysis
━━━━━━━━━━━━━━━━━━━━━━

Collection: orders
Query: { status: "pending", customerId: ObjectId("...") }

Execution Stats:
┌─────────────────────────┬─────────────┐
│ Metric                  │ Value       │
├─────────────────────────┼─────────────┤
│ Execution Time          │ 12ms        │
│ Documents Examined      │ 45          │
│ Documents Returned      │ 45          │
│ Index Used              │ ✅ Yes      │
│ Index Name              │ status_customer_idx │
│ Stage                   │ IXSCAN      │
└─────────────────────────┴─────────────┘

Performance: ✅ GOOD
- Ratio examined/returned: 1.0 (optimal)
- Using index scan
- Execution time < 100ms

Sample Results (first 3):
┌────────────────────────┬──────────┬─────────────┐
│ _id                    │ status   │ total       │
├────────────────────────┼──────────┼─────────────┤
│ 65a1b2c3d4e5f6g7h8i9j0 │ pending  │ $125.00     │
│ 65a1b2c3d4e5f6g7h8i9j1 │ pending  │ $89.50      │
│ 65a1b2c3d4e5f6g7h8i9j2 │ pending  │ $234.00     │
└────────────────────────┴──────────┴─────────────┘

Total: 45 documents
```

## Оптимизации

### Создание оптимального индекса

```javascript
// ESR Rule: Equality, Sort, Range
// Порядок полей в индексе:
// 1. Equality fields (exact match)
// 2. Sort fields
// 3. Range fields

// Для запроса:
// { status: "pending", customerId: ObjectId("...") }
// .sort({ createdAt: -1 })

db.orders.createIndex(
  { status: 1, customerId: 1, createdAt: -1 },
  { name: "orders_status_customer_date" }
)
```

### Covered Query

```javascript
// Запрос полностью покрыт индексом (не читает документы)
db.orders.find(
  { status: "pending" },
  { _id: 0, status: 1, createdAt: 1 }  // projection только индексированных полей
).hint("status_date_idx")
```

## Интеграция с .NET

```csharp
// MongoDB.Driver query
var filter = Builders<Order>.Filter.And(
    Builders<Order>.Filter.Eq(o => o.Status, "pending"),
    Builders<Order>.Filter.Eq(o => o.CustomerId, customerId)
);

var orders = await _collection
    .Find(filter)
    .Sort(Builders<Order>.Sort.Descending(o => o.CreatedAt))
    .Limit(100)
    .ToListAsync(ct);

// С explain
var explanation = await _collection
    .Find(filter)
    .Sort(Builders<Order>.Sort.Descending(o => o.CreatedAt))
    .ExplainAsync(ExplainVerbosity.ExecutionStats, ct);
```
