---
description: Отправить тестовое сообщение в Kafka-топик через kaf
user-invocable: true
allowed-tools: Bash
argument-hint: "topic --value '...' [--key K] [--header H=V] [--cluster name]"
---

# /kaf-produce

Отправить одно тестовое сообщение в топик.

**Goal:** Проверить продюсер/consumer/контракт без поднятия отдельного producer-приложения.

**Output:** Подтверждение (partition, offset, timestamp). При ошибке -- причина (auth, schema, ACL, broker not available).

**Scenarios:**

- `topic --value '{"id":1}'` -- отправить тестовое сообщение.
- `--key K` -- ключ сообщения (влияет на партицию).
- `--header H=V` (повторяемый) -- добавить заголовки.
- `--cluster name` -- использовать конкретный кластер.

**Constraints:**

- Требует `kaf` в PATH; если не найден -- показать инструкцию установки.
- **Только для диагностики**, не для нагрузочного теста и не для записи прод-данных. Если активный кластер -- production, потребовать в выводе явное подтверждение цели.
- Нагрузка из этой команды попадёт в реальный consumer'ы топика. Если у топика есть downstream-эффекты (events, биллинг, нотификации) -- использовать staging-топик или dedicated test-топик.
- Schema registry / Avro / Protobuf при необходимости настраиваются в `~/.kaf/config`.
