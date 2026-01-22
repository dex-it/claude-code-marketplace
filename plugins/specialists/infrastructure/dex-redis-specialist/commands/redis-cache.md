---
description: Управление Redis кэшем - статистика, анализ ключей, очистка
allowed-tools: Bash, Read, Grep
argument-hint: [--stats | --keys <pattern> | --clear <pattern>]
---

# /redis-cache

Управление и анализ Redis кэша.

## Использование

```
/redis-cache --stats              # Общая статистика
/redis-cache --keys "product:*"   # Поиск ключей по паттерну
/redis-cache --ttl "session:*"    # Проверка TTL ключей
/redis-cache --clear "cache:temp:*" # Очистка ключей (осторожно!)
```

## Процесс

### 1. Общая статистика

```bash
# Память
redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"

# Статистика
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses|total_commands_processed"

# Количество ключей
redis-cli DBSIZE
```

### 2. Анализ ключей

```bash
# Безопасный поиск через SCAN (НЕ использовать KEYS в prod!)
redis-cli --scan --pattern "$PATTERN" | head -100

# Тип ключа
redis-cli TYPE "$KEY"

# TTL ключа
redis-cli TTL "$KEY"

# Размер ключа
redis-cli MEMORY USAGE "$KEY"
```

### 3. Топ ключей по размеру

```bash
redis-cli --bigkeys
```

### 4. Slow Log

```bash
redis-cli SLOWLOG GET 10
```

### 5. Hit Ratio

```bash
# Получить значения
hits=$(redis-cli INFO stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
misses=$(redis-cli INFO stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')

# Вычислить ratio
echo "Hit ratio: $(echo "scale=2; $hits * 100 / ($hits + $misses)" | bc)%"
```

## Вывод

```
Redis Cache Status
==================

Connection: localhost:6379
Uptime: 12d 5h 32m

Memory:
- Used: 256MB / 1GB (25%)
- Fragmentation: 1.02

Keys: 15,234

Statistics:
- Hit Ratio: 94.5%
- Commands/sec: 12,500
- Connected Clients: 25

Key Analysis (pattern: cache:*):
+-------------------+--------+--------+---------+
| Pattern           | Count  | Size   | Avg TTL |
+-------------------+--------+--------+---------+
| cache:product:*   | 5,000  | 45MB   | 30min   |
| cache:user:*      | 3,500  | 12MB   | 1h      |
| cache:session:*   | 2,000  | 8MB    | 24h     |
| cache:temp:*      | 4,500  | 180MB  | varies  |
+-------------------+--------+--------+---------+

Warnings:
- cache:temp:* uses 70% of cache memory
- 234 keys have no TTL (will never expire)

Slow Commands (last 10):
1. KEYS product:* (120ms) - WARNING: use SCAN instead
2. HGETALL user:123:profile (15ms)

Recommendations:
- Set TTL for keys without expiration
- Replace KEYS with SCAN in application code
- Consider reducing TTL for cache:temp:*
```

## Действия

### Установить TTL для ключей без него
```bash
# Найти ключи без TTL
redis-cli --scan --pattern "cache:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  if [ "$ttl" = "-1" ]; then
    echo "Setting TTL for: $key"
    redis-cli EXPIRE "$key" 3600
  fi
done
```

### Очистить ключи по паттерну (осторожно!)
```bash
redis-cli --scan --pattern "cache:temp:*" | xargs redis-cli DEL
```

### Мониторинг в реальном времени
```bash
redis-cli MONITOR
```
