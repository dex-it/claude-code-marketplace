---
description: Статистика и анализ Redis кэша — memory, hit ratio, ключи, slow log
allowed-tools: Bash, Read, Grep
argument-hint: "[--stats | --keys <pattern> | --clear <pattern>]"
---

# /redis-cache

Быстрый снимок состояния Redis кэша.

**Goal:** Получить ключевые метрики Redis — memory usage, hit/miss ratio, top keys, slow commands.

**Scenarios:**
- Без аргументов или `--stats` — общая статистика: memory, keyspace, hit ratio, slow log
- `--keys <pattern>` — анализ ключей по паттерну: count, типы, TTL distribution, размеры
- `--clear <pattern>` — удаление ключей по паттерну (с confirmation)

**Output:** Таблица с метриками: memory used/max, hit ratio %, keyspace info, top slow commands. При `--keys` — таблица ключей с type, TTL, size.

**Constraints:**
- Использовать SCAN, не KEYS * (production safety)
- MONITOR только кратковременно, если нужен real-time анализ
- `--clear` требует explicit confirmation перед DEL
