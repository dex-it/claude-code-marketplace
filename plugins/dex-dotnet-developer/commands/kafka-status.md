---
description: Проверка статуса Kafka - cluster health, topics, consumer groups, lag
allowed-tools: Bash, Read, Grep
---

# /kafka-status

Проверка статуса Apache Kafka инфраструктуры.

## Использование

```
/kafka-status                    # Обзор кластера
/kafka-status topics             # Список топиков
/kafka-status groups             # Consumer groups
/kafka-status topic orders       # Детали топика
/kafka-status group my-group     # Детали consumer group
```

## Процесс

### 1. Проверка подключения к кластеру

```bash
# Через kafka-mcp-server (если установлен)
# Использует cluster_overview и list_brokers tools

# Через kafka CLI
kafka-broker-api-versions.sh --bootstrap-server localhost:9092 | head -5

# Или простая проверка
kafka-topics.sh --bootstrap-server localhost:9092 --list > /dev/null && echo "OK" || echo "FAILED"
```

### 2. Информация о кластере

```bash
# Список брокеров
kafka-metadata.sh --snapshot /var/kafka-logs/__cluster_metadata-0/00000000000000000000.log --command "broker-info"

# Или через zookeeper (legacy)
zookeeper-shell.sh localhost:2181 <<< "ls /brokers/ids"
```

### 3. Список топиков

```bash
# Все топики
kafka-topics.sh --bootstrap-server localhost:9092 --list

# С деталями (partitions, replication)
kafka-topics.sh --bootstrap-server localhost:9092 --describe

# Конкретный топик
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

### 4. Consumer Groups

```bash
# Список групп
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

# Детали группы с lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group my-consumer-group

# Все группы с lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups
```

### 5. Проверка Consumer Lag

```bash
# Lag по группе
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group my-group | awk 'NR>1 {sum+=$6} END {print "Total lag:", sum}'

# Группы с lag > 0
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups 2>/dev/null | awk '$6 > 0 {print $1, $2, "lag:", $6}'
```

## Вывод

```
Kafka Cluster Status
====================

Connection: OK
Brokers: 3

Broker Details:
+----+----------------------+------+
| ID | Host                 | Port |
+----+----------------------+------+
| 1  | kafka-1.example.com  | 9092 |
| 2  | kafka-2.example.com  | 9092 |
| 3  | kafka-3.example.com  | 9092 |
+----+----------------------+------+

Topics (12):
+------------------------+------------+-------------+
| Name                   | Partitions | Replication |
+------------------------+------------+-------------+
| orders                 | 6          | 3           |
| orders.dlq             | 3          | 3           |
| payments               | 6          | 3           |
| notifications          | 3          | 2           |
| user-events            | 12         | 3           |
+------------------------+------------+-------------+

Consumer Groups (4):
+-------------------------+--------+-----------+--------+
| Group                   | State  | Members   | Lag    |
+-------------------------+--------+-----------+--------+
| order-processor         | Stable | 3         | 0      |
| payment-handler         | Stable | 2         | 0      |
| notification-sender     | Stable | 1         | 156    | <-- WARNING
| analytics-consumer      | Empty  | 0         | 45230  | <-- CRITICAL
+-------------------------+--------+-----------+--------+

Warnings:
- notification-sender: lag 156 messages
- analytics-consumer: EMPTY group with lag 45230 (no active consumers!)
- orders.dlq: contains messages (Dead Letter Topic)

Recommendations:
- Check analytics-consumer service health
- Process DLQ messages: kafka-console-consumer.sh --topic orders.dlq --from-beginning
- Consider scaling notification-sender consumers
```

## Действия при проблемах

### Consumer Group отстает (высокий lag)

```bash
# Проверить активных consumers
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group my-group --members

# Добавить consumers или увеличить partitions
kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic my-topic --partitions 12
```

### Consumer Group в состоянии Empty

```bash
# Проверить что сервис запущен
# Проверить конфигурацию group.id
# Проверить сетевую доступность Kafka
```

### Просмотреть сообщения в DLQ

```bash
# Последние 10 сообщений
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic orders.dlq \
  --from-beginning \
  --max-messages 10 \
  --property print.headers=true \
  --property print.timestamp=true
```

### Сбросить offset consumer group

```bash
# К earliest (перечитать все)
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group my-group \
  --topic my-topic \
  --reset-offsets \
  --to-earliest \
  --execute

# К latest (пропустить все)
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group my-group \
  --topic my-topic \
  --reset-offsets \
  --to-latest \
  --execute

# К конкретному времени
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group my-group \
  --topic my-topic \
  --reset-offsets \
  --to-datetime 2024-01-15T10:00:00.000 \
  --execute
```

### Удалить топик (осторожно!)

```bash
kafka-topics.sh --bootstrap-server localhost:9092 --delete --topic test-topic
```

## MCP Integration

При наличии kafka-mcp-server доступны инструменты:
- `cluster_overview` - обзор кластера
- `list_brokers` - список брокеров
- `list_topics` - список топиков
- `describe_topic` - детали топика
- `list_consumer_groups` - список consumer groups
- `describe_consumer_group` - детали группы с lag
- `produce_message` - отправка сообщения
- `consume_messages` - чтение сообщений
- `describe_configs` - конфигурация топика/брокера
