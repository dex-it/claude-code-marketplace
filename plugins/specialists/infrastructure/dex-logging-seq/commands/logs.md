---
description: Анализ логов — поиск ошибок, trace по correlation ID, slow requests
allowed-tools: Bash, Read, Grep
argument-hint: "[--errors | --trace <correlation-id> | --last <minutes>]"
---

# /logs

Быстрый поиск и анализ логов приложения.

**Goal:** Найти ошибки, построить request trace, или показать логи за период — из Seq, Elasticsearch или файлов.

**Scenarios:**
- `--errors` или без аргументов — top ошибки за последний час: error template, count, affected services
- `--trace <correlation-id>` — полный request trace: все события по correlation ID, sorted by timestamp
- `--last <minutes>` — все логи за N минут, grouped by level
- `--slow` — slow requests (> P95 response time)

**Output:** Таблицы: errors (template, count, last seen), trace (timestamp, service, level, message). Summary по log levels (Error/Warning/Info counts).

**Constraints:**
- Определить log source (Seq API, Elasticsearch, файлы) в начале
- Для файлов — искать в стандартных путях (/var/log, ./logs)
- Не выводить полный stack trace — только first line + file:line
