---
description: Анализ памяти Redis — top keys, fragmentation, eviction
user-invocable: true
allowed-tools: Bash
argument-hint: "[--bigkeys | --top N | key] [-u redis://...]"
---

# /redis-memory

Анализ потребления памяти.

**Goal:** Понять, кто ест RAM в Redis: топ ключей по размеру, fragmentation ratio, активная eviction policy.

**Output:** Сводка по памяти (`used_memory_human`, `used_memory_rss_human`, `mem_fragmentation_ratio`, `maxmemory`, `maxmemory_policy`), список тяжёлых ключей с размером в байтах и типом.

**Scenarios:**

- Без аргументов -- общая сводка по памяти.
- `--bigkeys` -- встроенный `redis-cli --bigkeys`: самые большие ключи каждого типа (один проход через SCAN, не блокирует).
- `--top N` -- top-N ключей по `MEMORY USAGE` (через SCAN + sample, может быть долго на больших keyspace).
- `key` -- `MEMORY USAGE key SAMPLES 0` для конкретного ключа.
- `-u redis://...` -- явная строка подключения.

**Constraints:**

- Требует `redis-cli` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- `--top N` сэмплирует через SCAN -- на больших инстансах ограничивать N (≤100) и предупреждать о времени.
- `MEMORY USAGE` доступна с Redis 4.0+; на более старых -- сообщить и предложить `--bigkeys`.
- Read-only.
