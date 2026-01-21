---
description: Выполнение и анализ Elasticsearch запросов - поиск, агрегации, производительность
allowed-tools: Bash, Read, Grep
argument-hint: <query-text или index-name>
---

# /es-query

Выполнение и анализ Elasticsearch запросов.

## Использование

```
/es-query products "красный телефон"    # Поиск в индексе
/es-query logs --errors                  # Ошибки в логах
/es-query --health                       # Здоровье кластера
/es-query products --mapping             # Маппинг индекса
```

## Процесс

### 1. Проверка кластера

```bash
curl -s "http://localhost:9200/_cluster/health?pretty"
```

### 2. Информация об индексе

```bash
# Статистика
curl -s "http://localhost:9200/$INDEX/_stats" | jq '.indices[].primaries | {docs: .docs.count, size: .store.size_in_bytes}'

# Маппинг
curl -s "http://localhost:9200/$INDEX/_mapping?pretty"
```

### 3. Выполнение поиска

```bash
# Простой поиск
curl -s -X POST "http://localhost:9200/$INDEX/_search" -H 'Content-Type: application/json' -d '{
  "query": {
    "multi_match": {
      "query": "'$QUERY'",
      "fields": ["name^2", "description"],
      "fuzziness": "AUTO"
    }
  },
  "size": 10
}'
```

### 4. Поиск ошибок в логах

```bash
curl -s -X POST "http://localhost:9200/logs/_search" -H 'Content-Type: application/json' -d '{
  "query": {
    "bool": {
      "must": [
        {"match": {"level": "Error"}}
      ],
      "filter": [
        {"range": {"@timestamp": {"gte": "now-1h"}}}
      ]
    }
  },
  "sort": [{"@timestamp": "desc"}],
  "size": 20
}'
```

### 5. Агрегации

```bash
curl -s -X POST "http://localhost:9200/$INDEX/_search" -H 'Content-Type: application/json' -d '{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": {"field": "category", "size": 10}
    }
  }
}'
```

### 6. Анализ производительности

```bash
# С профилированием
curl -s -X POST "http://localhost:9200/$INDEX/_search" -H 'Content-Type: application/json' -d '{
  "profile": true,
  "query": { ... }
}'
```

## Вывод

```
Elasticsearch Query Analysis
============================

Cluster: green (3 nodes)
Index: products
- Documents: 1,234,567
- Size: 450MB

Query: "красный телефон"
Results: 156 hits (took 12ms)

Top Results:
1. [0.95] iPhone 15 Red - Красный телефон Apple
2. [0.87] Samsung Galaxy Red Edition
3. [0.72] Xiaomi Red Mi

Aggregations:
+-------------+-------+
| Category    | Count |
+-------------+-------+
| phones      | 89    |
| accessories | 45    |
| tablets     | 22    |
+-------------+-------+

Query Performance:
- Total time: 12ms
- Shards: 3/3 successful

Recommendations:
- Consider adding category filter for better results
- Index has good mapping for search
```

## Полезные запросы

### Список всех индексов
```bash
curl -s "http://localhost:9200/_cat/indices?v&s=store.size:desc"
```

### Анализ текста
```bash
curl -s -X POST "http://localhost:9200/$INDEX/_analyze" -H 'Content-Type: application/json' -d '{
  "text": "search term"
}'
```

### Explain scoring
```bash
curl -s -X GET "http://localhost:9200/$INDEX/_explain/DOC_ID" -H 'Content-Type: application/json' -d '{
  "query": { "match": { "name": "search term" } }
}'
```
