---
description: Список и детали топиков Kafka через kaf
user-invocable: true
allowed-tools: Bash
argument-hint: "[topic-name] [--describe] [--cluster name]"
---

# /kaf-topics

Показать топики Kafka или детали конкретного топика.

**Goal:** Быстро увидеть, какие топики есть в кластере и их параметры (partitions, replication factor, retention, размер).

**Output:** Таблица топиков (name, partitions, replication, messages). Для конкретного топика -- детали: partition leader/replicas/ISR, configs (`retention.ms`, `cleanup.policy`, `min.insync.replicas`), размер.

**Scenarios:**

- Без аргументов -- список всех топиков активного кластера (`kaf topics`).
- `topic-name` -- детали топика (`kaf topic describe`).
- `--describe` с/без имени -- расширенный вывод (configs, ISR).
- `--cluster name` -- использовать конкретный кластер из `~/.kaf/config` вместо активного.

**Constraints:**

- Требует `kaf` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Кластер настраивается в `~/.kaf/config` (`kaf config add-cluster ...` / `kaf config select-cluster ...`). Без активного кластера -- сообщить и подсказать команду.
- Read-only.
