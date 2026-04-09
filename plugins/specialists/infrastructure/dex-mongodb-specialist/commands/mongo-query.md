---
description: Выполнение MongoDB запросов и анализ производительности
allowed-tools: Bash, Read, Grep
---

# /mongo-query

Выполнение запросов к MongoDB с анализом производительности.

**Goal:** Выполнить запрос и показать результаты с execution stats (index usage, docs examined, execution time).

**Scenarios:**
- `find <collection> <filter>` — поиск документов с explain
- `explain <collection> <filter>` — план выполнения запроса с executionStats
- `indexes <collection>` — список индексов с usage stats
- `stats <collection>` — размер, doc count, avg doc size, index sizes
- `aggregate <collection> <pipeline>` — агрегация с explain

**Output:** Результаты запроса + execution stats: nReturned, totalDocsExamined, executionTimeMs, используемый index. Для explain — winning plan, rejected plans.

**Constraints:**
- Добавлять .limit() к find-запросам по умолчанию
- explain с "executionStats", не "allPlansExecution" на production (ресурсоёмко)
- Для aggregation — предупредить если нет $limit в pipeline
