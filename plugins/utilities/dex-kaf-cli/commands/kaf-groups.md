---
description: Consumer groups Kafka и их lag через kaf
user-invocable: true
allowed-tools: Bash
argument-hint: "[group-name] [--cluster name]"
---

# /kaf-groups

Показать consumer groups и их состояние.

**Goal:** Увидеть, какие consumer groups активны, их lag по партициям, members.

**Output:** Список groups (name, state, members count, total lag). Для конкретной группы -- разбивка по топику/партиции: current offset, log-end offset, lag, member.

**Scenarios:**

- Без аргументов -- список всех consumer groups активного кластера.
- `group-name` -- детали группы: per-topic, per-partition lag и assignments.
- `--cluster name` -- использовать конкретный кластер из `~/.kaf/config`.

**Constraints:**

- Требует `kaf` в PATH; если не найден -- показать инструкцию установки.
- Read-only.
- Растущий lag -- сигнал, что consumer не успевает или упал; команда **не** перезапускает consumer'ов и не сбрасывает offset'ы (это делает оператор отдельно через `kaf group commit`/`kaf group reset`).
