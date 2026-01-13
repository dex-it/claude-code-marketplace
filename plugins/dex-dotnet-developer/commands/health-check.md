---
description: Комплексная проверка здоровья всех сервисов и инфраструктуры
allowed-tools: Bash, Read, Grep
---

# /health-check

Комплексная проверка здоровья всех компонентов системы.

## Использование

```
/health-check                 # Проверить всё
/health-check db              # Только базы данных
/health-check messaging       # RabbitMQ, Kafka
/health-check cache           # Redis
/health-check search          # Elasticsearch
/health-check app             # Application endpoints
/health-check k8s             # Kubernetes pods
```

## Компоненты для проверки

### 1. Application Health Endpoints

```bash
# ASP.NET Core health checks
curl -s http://localhost:5000/health | jq
curl -s http://localhost:5000/health/ready | jq
curl -s http://localhost:5000/health/live | jq
```

### 2. PostgreSQL

```bash
# Connection check
psql "$DATABASE_URL" -c "SELECT 1" 2>/dev/null && echo "✅ PostgreSQL OK" || echo "❌ PostgreSQL FAIL"

# Connections usage
psql "$DATABASE_URL" -c "SELECT count(*) as active, max_conn FROM pg_stat_activity, (SELECT setting::int max_conn FROM pg_settings WHERE name='max_connections') mc GROUP BY max_conn"

# Slow queries (if pg_stat_statements enabled)
psql "$DATABASE_URL" -c "SELECT LEFT(query, 50), calls, round(mean_exec_time::numeric, 2) as avg_ms FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5"
```

### 3. MongoDB

```bash
# Connection check (через MongoDB MCP или mongosh)
mongosh "$MONGODB_URI" --eval "db.runCommand({ping: 1})"

# Server status
mongosh "$MONGODB_URI" --eval "db.serverStatus().connections"

# Replica set status (if applicable)
mongosh "$MONGODB_URI" --eval "rs.status()"
```

### 4. RabbitMQ

```bash
# Management API
curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" \
  "http://$RABBITMQ_HOST:15672/api/overview" | jq '.queue_totals'

# Queue status
curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" \
  "http://$RABBITMQ_HOST:15672/api/queues" | jq '.[].name, .[].messages'

# Dead letter queues
curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" \
  "http://$RABBITMQ_HOST:15672/api/queues" | jq '.[] | select(.name | contains("dlq")) | {name, messages}'
```

### 5. Redis

```bash
# Ping
redis-cli -u "$REDIS_URL" PING

# Info
redis-cli -u "$REDIS_URL" INFO server | grep -E "redis_version|uptime"
redis-cli -u "$REDIS_URL" INFO memory | grep -E "used_memory_human|maxmemory"
redis-cli -u "$REDIS_URL" INFO clients | grep connected_clients

# Slowlog
redis-cli -u "$REDIS_URL" SLOWLOG GET 5
```

### 6. Elasticsearch

```bash
# Cluster health
curl -s "$ELASTICSEARCH_URL/_cluster/health" | jq '{status, number_of_nodes, active_shards}'

# Indices status
curl -s "$ELASTICSEARCH_URL/_cat/indices?format=json" | jq '.[] | {index, health, "docs.count"}'

# Pending tasks
curl -s "$ELASTICSEARCH_URL/_cluster/pending_tasks" | jq
```

### 7. Seq

```bash
# Health check
curl -s "$SEQ_SERVER_URL/api" | jq

# Recent errors (last hour)
curl -s -H "X-Seq-ApiKey: $SEQ_API_KEY" \
  "$SEQ_SERVER_URL/api/events?filter=@Level='Error'&count=10" | jq
```

### 8. Kubernetes

```bash
# Pod status
kubectl get pods -n default -o wide

# Pods not running
kubectl get pods --all-namespaces --field-selector=status.phase!=Running

# Resource usage
kubectl top pods -n default

# Recent events
kubectl get events -n default --sort-by='.lastTimestamp' | tail -10
```

### 9. Grafana Metrics

```bash
# Через Grafana MCP или API
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/health" | jq

# Alert status
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" \
  "$GRAFANA_URL/api/alerts" | jq '.[] | {name, state}'
```

## Выходной формат

```
Health Check Report
━━━━━━━━━━━━━━━━━━━
Timestamp: 2024-01-15 14:30:00 UTC

Application:
┌────────────────────┬──────────┬─────────────┐
│ Endpoint           │ Status   │ Response    │
├────────────────────┼──────────┼─────────────┤
│ /health            │ ✅ OK    │ 12ms        │
│ /health/ready      │ ✅ OK    │ 45ms        │
│ /health/live       │ ✅ OK    │ 8ms         │
└────────────────────┴──────────┴─────────────┘

Databases:
┌────────────────────┬──────────┬─────────────┐
│ Service            │ Status   │ Details     │
├────────────────────┼──────────┼─────────────┤
│ PostgreSQL         │ ✅ OK    │ 45/100 conn │
│ MongoDB            │ ✅ OK    │ RS: PRIMARY │
└────────────────────┴──────────┴─────────────┘

Messaging:
┌────────────────────┬──────────┬─────────────┐
│ Service            │ Status   │ Details     │
├────────────────────┼──────────┼─────────────┤
│ RabbitMQ           │ ✅ OK    │ 5 queues    │
│ DLQ Messages       │ ⚠️ WARN  │ 23 msgs     │
└────────────────────┴──────────┴─────────────┘

Cache & Search:
┌────────────────────┬──────────┬─────────────┐
│ Service            │ Status   │ Details     │
├────────────────────┼──────────┼─────────────┤
│ Redis              │ ✅ OK    │ 256MB/1GB   │
│ Elasticsearch      │ ✅ OK    │ green, 3 nodes │
└────────────────────┴──────────┴─────────────┘

Kubernetes:
┌────────────────────┬──────────┬─────────────┐
│ Component          │ Status   │ Details     │
├────────────────────┼──────────┼─────────────┤
│ Pods Running       │ ✅ OK    │ 12/12       │
│ CPU Usage          │ ✅ OK    │ 45%         │
│ Memory Usage       │ ⚠️ WARN  │ 78%         │
└────────────────────┴──────────┴─────────────┘

Summary: 11/12 ✅ OK, 1 ⚠️ WARN, 0 ❌ FAIL

Warnings:
- DLQ has 23 unprocessed messages
- Memory usage above 75% threshold

Recommendations:
1. Process dead letter queue messages
2. Consider scaling pods or increasing memory limits
```

## Автоматизация

Добавить в CI/CD pipeline:
```yaml
health-check:
  stage: deploy
  script:
    - ./scripts/health-check.sh
  after_script:
    - if [ $? -ne 0 ]; then ./scripts/rollback.sh; fi
```
