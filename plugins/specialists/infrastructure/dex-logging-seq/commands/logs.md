---
description: Анализ логов приложения - Serilog, Seq, поиск ошибок, корреляция
allowed-tools: Bash, Read, Grep
argument-hint: [--errors | --trace <correlation-id> | --last <minutes>]
---

# /logs

Анализ логов приложения (Seq, Elasticsearch, файлы).

## Использование

```
/logs --errors                     # Последние ошибки
/logs --trace abc-123-def          # Трейс по correlation ID
/logs --last 30                    # Логи за последние 30 минут
/logs --slow                       # Медленные запросы
```

## Процесс

### 1. Определить источник логов

```bash
# Проверить Seq
curl -s "http://localhost:5341/api/events?count=1" -H "X-Seq-ApiKey: $SEQ_API_KEY" 2>/dev/null && echo "Seq: Available"

# Проверить Elasticsearch
curl -s "http://localhost:9200/logs/_count" 2>/dev/null && echo "Elasticsearch: Available"

# Локальные файлы
find . -name "*.log" -type f 2>/dev/null | head -5
```

### 2. Поиск ошибок (Seq)

```bash
curl -s "http://localhost:5341/api/events?filter=@Level='Error'&count=20" \
  -H "X-Seq-ApiKey: $SEQ_API_KEY" | jq '.[] | {timestamp: .Timestamp, message: .RenderedMessage, exception: .Exception}'
```

### 3. Поиск ошибок (Elasticsearch)

```bash
curl -s -X POST "http://localhost:9200/logs/_search" -H 'Content-Type: application/json' -d '{
  "query": {
    "bool": {
      "must": [{"match": {"level": "Error"}}],
      "filter": [{"range": {"@timestamp": {"gte": "now-1h"}}}]
    }
  },
  "sort": [{"@timestamp": "desc"}],
  "size": 20
}'
```

### 4. Трейс по Correlation ID (Seq)

```bash
curl -s "http://localhost:5341/api/events?filter=CorrelationId='$CORRELATION_ID'" \
  -H "X-Seq-ApiKey: $SEQ_API_KEY" | jq 'sort_by(.Timestamp) | .[] | {time: .Timestamp, level: .Level, message: .RenderedMessage}'
```

### 5. Медленные запросы

```bash
# Seq: запросы > 1000ms
curl -s "http://localhost:5341/api/events?filter=Elapsed>1000&count=20" \
  -H "X-Seq-ApiKey: $SEQ_API_KEY" | jq '.[] | {path: .RequestPath, elapsed: .Elapsed, statusCode: .StatusCode}'
```

### 6. Локальные log файлы

```bash
# Ошибки в JSON логах
cat app.log | jq 'select(.Level == "Error" or .Level == "Fatal")'

# Ошибки в текстовых логах
grep -i "error\|exception\|fatal" app.log | tail -50
```

## Вывод

```
Log Analysis
============

Source: Seq (http://localhost:5341)
Period: Last 1 hour

Summary:
+-------------+--------+---------+
| Level       | Count  | Percent |
+-------------+--------+---------+
| Information | 14,500 | 95.2%   |
| Warning     | 650    | 4.3%    |
| Error       | 80     | 0.5%    |
| Fatal       | 4      | 0.03%   |
+-------------+--------+---------+
Total: 15,234 events

Recent Errors (top 5):

1. [10 occurrences] NullReferenceException in OrderService.GetOrder
   CorrelationId: abc-123
   Message: Object reference not set to an instance
   Stack: OrderService.cs:42

2. [5 occurrences] TimeoutException in PaymentGateway.Process
   Average Duration: 35s
   Message: Operation timed out

3. [3 occurrences] DbUpdateException in ProductRepository.Save
   Message: Unique constraint violation

Slow Requests (>500ms):
+-------------------+----------+----------+--------+
| Endpoint          | Avg (ms) | Max (ms) | Count  |
+-------------------+----------+----------+--------+
| POST /api/orders  | 1,200    | 3,500    | 45     |
| GET /api/search   | 800      | 2,100    | 120    |
| PUT /api/users    | 600      | 1,500    | 30     |
+-------------------+----------+----------+--------+

Correlation Trace (abc-123):
[12:00:00.000] INFO  POST /api/orders started
[12:00:00.050] DEBUG OrderService.CreateOrder called
[12:00:00.100] DEBUG ProductRepository.GetByIds (5 items)
[12:00:00.500] ERROR NullReferenceException: order.Customer was null
[12:00:00.510] INFO  Request failed with 500

Recommendations:
1. Fix null check in OrderService.GetOrder (line 42)
2. Implement circuit breaker for PaymentGateway
3. Add unique constraint validation before save
4. Optimize /api/search query (consider caching)
```

## Полезные фильтры Seq

```bash
# Ошибки конкретного сервиса
filter=@Level='Error' and Application='OrderService'

# По времени
filter=@Timestamp > Now() - 1h

# По пользователю
filter=UserId = 'user123'

# По HTTP статусу
filter=StatusCode >= 500

# Комбинированный
filter=@Level='Error' and Application='API' and @Timestamp > Now() - 30m
```
