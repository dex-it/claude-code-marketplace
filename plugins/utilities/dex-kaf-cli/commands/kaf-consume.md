---
description: Прочитать последние сообщения из Kafka-топика для отладки
user-invocable: true
allowed-tools: Bash
argument-hint: "topic [--from beginning|latest] [--limit N] [--key pattern] [--cluster name]"
---

# /kaf-consume

Прочитать сообщения из топика для отладки.

**Goal:** Tail последних N сообщений топика для проверки формата/содержимого без подключения нового consumer'а к проду.

**Output:** Список сообщений: partition, offset, timestamp, key, headers, value (decoded JSON если применимо).

**Scenarios:**

- `topic` -- последние сообщения с конца топика (по умолчанию `--limit 10`, `--from latest`).
- `--from beginning` -- читать с начала retention.
- `--limit N` -- сколько сообщений (default 10, max 1000).
- `--key pattern` -- фильтр по ключу (regex).
- `--cluster name` -- использовать конкретный кластер.

**Constraints:**

- Требует `kaf` в PATH; если не найден -- показать инструкцию установки.
- Создаёт временный consumer вне consumer group (или с временной group-id) -- не влияет на committed offsets продакшен-consumer'ов.
- `--limit` обязателен -- консьюмер всегда ограничен по числу сообщений и по таймауту, не висит.
- Большие сообщения (> 1 MB) обрезать в выводе и указывать полный размер.
- Если schema registry / Avro -- декодер настраивается в `~/.kaf/config`; без него вывод как raw bytes / попытка парсинга JSON.
