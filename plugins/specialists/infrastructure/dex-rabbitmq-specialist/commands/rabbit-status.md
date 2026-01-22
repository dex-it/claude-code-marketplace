---
description: Проверка статуса RabbitMQ - очереди, exchanges, consumers, dead-letter
allowed-tools: Bash, Read, Grep
---

# /rabbit-status

Проверка статуса RabbitMQ инфраструктуры.

## Использование

```
/rabbit-status                    # Все очереди
/rabbit-status order_processing   # Конкретная очередь
```

## Процесс

### 1. Проверка подключения

```bash
# Через Management API
curl -s -u guest:guest http://localhost:15672/api/overview | jq '{rabbitmq_version, cluster_name, node}'
```

### 2. Список очередей

```bash
# Через rabbitmqadmin
rabbitmqadmin list queues name messages consumers state

# Через API
curl -s -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name, messages, consumers, state}'
```

### 3. Проверка Dead-Letter очередей

```bash
# Очереди с "dlq" или "dead" в названии
curl -s -u guest:guest http://localhost:15672/api/queues | jq '.[] | select(.name | test("dlq|dead"; "i")) | {name, messages}'
```

### 4. Статус consumers

```bash
curl -s -u guest:guest http://localhost:15672/api/consumers | jq '.[] | {queue: .queue.name, consumer_tag, prefetch_count}'
```

### 5. Exchanges и bindings

```bash
# Список exchanges
rabbitmqadmin list exchanges name type

# Bindings
rabbitmqadmin list bindings source destination routing_key
```

## Вывод

```
RabbitMQ Status
===============

Connection: OK
Version: 3.12.0
Node: rabbit@hostname

Queues (5):
+-----------------------+----------+------------+---------+
| Name                  | Messages | Consumers  | State   |
+-----------------------+----------+------------+---------+
| order.created         | 0        | 3          | running |
| order.processing      | 12       | 2          | running |
| order.dlq             | 3        | 0          | idle    | <-- WARNING
| notification.email    | 0        | 1          | running |
| notification.sms      | 0        | 1          | running |
+-----------------------+----------+------------+---------+

Exchanges (3):
+---------------+--------+
| Name          | Type   |
+---------------+--------+
| orders        | topic  |
| notifications | fanout |
| dlx           | direct |
+---------------+--------+

Warnings:
- order.dlq has 3 unprocessed messages (Dead Letter Queue)
- notification.sms has only 1 consumer

Recommendations:
- Process dead-letter messages: rabbitmqadmin get queue=order.dlq count=5
- Consider adding more consumers to notification.sms
```

## Действия при проблемах

### Просмотреть сообщения в DLQ
```bash
rabbitmqadmin get queue=order.dlq count=5 payload_file=/tmp/msg.json
cat /tmp/msg.json | jq
```

### Очистить очередь (осторожно!)
```bash
rabbitmqadmin purge queue name=test_queue
```

### Переместить из DLQ обратно
```bash
# Через shovel или вручную republish
```
