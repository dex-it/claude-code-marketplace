---
description: Короткий sample real-time активности Redis (latency или MONITOR)
user-invocable: true
allowed-tools: Bash
argument-hint: "[--seconds N] [--latency | --commands] [-u redis://...]"
---

# /redis-monitor

Снять короткий sample real-time активности Redis для диагностики.

**Goal:** Увидеть, что прямо сейчас идёт в Redis (latency или поток команд) -- без оставления висящего MONITOR.

**Output:** Для `--latency` -- min/avg/max/p99 за период. Для `--commands` -- агрегация по типам команд за период (count + примеры).

**Scenarios:**

- Без аргументов или `--latency` -- `redis-cli --latency` ограниченный по времени (по умолчанию 5 сек).
- `--commands --seconds N` -- `MONITOR` на N секунд (default 5, max 10), агрегировать команды.
- `-u redis://...` -- явная строка подключения.

**Constraints:**

- Требует `redis-cli` в PATH; если не найден -- показать инструкцию установки.
- **`MONITOR` бьёт по производительности на проде** -- использовать только короткий sample (≤10 сек), всегда с явным timeout. Никогда не оставлять висящий процесс. Если команда зависла -- послать SIGTERM.
- Не запускать на проде в часы пик без согласования.
- На реплике в режиме `replica-read-only` -- учитывать, что `MONITOR` показывает только команды, попадающие на эту реплику.
