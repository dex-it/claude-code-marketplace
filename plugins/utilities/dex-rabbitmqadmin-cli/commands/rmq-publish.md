---
description: Опубликовать тестовое сообщение в RabbitMQ-exchange через rabbitmqadmin
user-invocable: true
allowed-tools: Bash
argument-hint: "exchange --routing-key K --payload '...' [--header H=V] [--vhost name]"
---

# /rmq-publish

Отправить одно тестовое сообщение в exchange.

**Goal:** Проверить продюсер/consumer/binding/контракт без поднятия отдельного producer-приложения.

**Output:** Результат публикации (`routed: true|false`). При `routed: false` -- предупреждение, что ни один binding не сматчился.

**Scenarios:**

- `exchange --routing-key K --payload '{"id":1}'` -- опубликовать в exchange с routing key.
- `--header H=V` (повторяемый) -- AMQP headers (для headers exchange).
- `--vhost name` -- vhost (по умолчанию `/`).

**Constraints:**

- Требует `rabbitmqadmin` в PATH; если не найден -- показать инструкцию установки.
- **Только для диагностики**, не для нагрузочного теста и не для записи прод-данных. Если активный кластер -- production, потребовать в выводе явное подтверждение цели.
- Сообщение реально попадёт в очереди, привязанные к exchange -- если у них есть downstream-эффекты (events, биллинг, нотификации), использовать staging/test exchange.
- Публикация идёт через HTTP API (rabbitmqadmin) -- не через AMQP-соединение; для нагрузочного теста используйте полноценный AMQP-клиент.
